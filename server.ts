import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PrismaClient, Prisma } from '@prisma/client';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
if (JWT_SECRET === 'super-secret-key-change-me') {
  console.warn('[SECURITY] WARNING: JWT_SECRET is using default value.');
}

// Persistent storage configuration
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || 'data';
const UPLOADS_DIR = path.join(PERSISTENT_DIR, 'uploads');
const CSV_STORAGE_DIR = path.join(UPLOADS_DIR, 'csv');
const BACKUPS_DIR = path.join(PERSISTENT_DIR, 'backups');
const SECURITY_LOG_FILE = path.join(PERSISTENT_DIR, 'security.log');

// Ensure directories exist
[PERSISTENT_DIR, UPLOADS_DIR, CSV_STORAGE_DIR, BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    // Handle both file:path and file://path
    const rawPath = dbUrl.replace(/^file:(\/\/)?/, '');
    return path.resolve(rawPath);
  }
  return path.resolve('data/guild.db');
}

/**
 * Trigger database recovery by renaming corrupted file and exiting.
 * The Docker environment will restart the container and recreate the DB.
 */
function triggerDatabaseRecovery() {
  try {
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
      const bakPath = `${dbPath}.malformed.${Date.now()}`;
      fs.renameSync(dbPath, bakPath);
      console.error(`[DB RECOVERY] Corrupted database renamed to ${bakPath}.`);
      console.error('[DB RECOVERY] Exiting process to trigger fresh initialization on restart...');
      process.exit(1);
    }
  } catch (err) {
    console.error('[DB RECOVERY] Failed to rename corrupted database:', err);
    process.exit(1); // Still exit so container orchestrator can try to fix it
  }
}

/**
 * Handle Prisma errors gracefully.
 */
function handlePrismaError(e: any, res: any) {
  if (e instanceof Prisma.PrismaClientUnknownRequestError) {
    const message = e.message || '';
    if (message.includes('malformed') || message.includes('database disk image is malformed')) {
      console.error('[PRISMA ERROR] Detected database corruption at runtime. Triggering recovery...');
      // Inform client and then recover
      res.status(500).json({ error: 'Erro de integridade no banco de dados. O sistema está se recuperando e reiniciará em instantes.' });
      
      // Delay exit slightly to allow response to be sent
      setTimeout(() => triggerDatabaseRecovery(), 1000);
      return;
    }
  }
  
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle specific known error codes if needed
    // https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
  }

  console.error('[ERROR]', e);
  res.status(500).json({ error: e.message || 'Erro interno no servidor' });
}

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: http: 'unsafe-inline' 'unsafe-eval' ws: wss:; img-src 'self' data: https: http:; font-src 'self' data: https: http:; frame-ancestors 'self' https://*.run.app https://*.google.com https://*.aistudio.google.com https://*.googleusercontent.com;"
  );
  next();
});

app.use(express.json());
app.use(cookieParser());

// Setup Database
const prisma = new PrismaClient();

/**
 * Validates table names to prevent SQL injection in raw queries.
 */
function isValidTableName(name: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

/**
 * Safe sanitization helpers for old database versions / structures.
 */
function sanitizeInt(val: any, def = 0): number {
  if (val === undefined || val === null) return def;
  if (typeof val === 'number') return Math.floor(val);
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? def : parsed;
}

function mapOldUsers(arr: any[]) {
  return arr.map(item => ({
    ...item,
    is_blocked: (item.is_blocked === true || item.is_blocked === 1 || String(item.is_blocked).toLowerCase() === 'true') ? 1 : 0
  }));
}

function mapOldRiftSeasons(arr: any[]) {
  return arr.map(item => ({
    ...item,
    season_number: sanitizeInt(item.season_number, 1),
  }));
}

function mapOldMemberRoles(arr: any[]) {
  return arr.map(item => ({
    ...item,
    member_id: sanitizeInt(item.member_id)
  }));
}

function mapOldPowerHistory(arr: any[]) {
  return arr.map(item => {
    let pVal = BigInt(0);
    try {
      pVal = item.power !== undefined && item.power !== null ? BigInt(item.power) : BigInt(0);
    } catch (_) {}
    return {
      ...item,
      member_id: sanitizeInt(item.member_id),
      power: pVal,
      import_id: item.import_id !== undefined && item.import_id !== null ? sanitizeInt(item.import_id, null as any) : null
    };
  });
}

function mapOldGuerraTotal(arr: any[]) {
  return arr.map(item => {
    let pVal = BigInt(0);
    try {
      pVal = item.power !== undefined && item.power !== null ? BigInt(item.power) : BigInt(0);
    } catch (_) {}
    return {
      ...item,
      member_id: sanitizeInt(item.member_id),
      power: pVal,
      import_id: item.import_id !== undefined && item.import_id !== null ? sanitizeInt(item.import_id, null as any) : null
    };
  });
}

function mapOldTorneioCeleste(arr: any[]) {
  return arr.map(item => ({
    ...item,
    member_id: sanitizeInt(item.member_id),
    score: sanitizeInt(item.score),
    import_id: item.import_id !== undefined && item.import_id !== null ? sanitizeInt(item.import_id, null as any) : null
  }));
}

function mapOldPicoGloria(arr: any[]) {
  return arr.map(item => {
    let roundVal = 1;
    if (item.round !== undefined && item.round !== null) {
      if (typeof item.round === 'string') {
        const match = item.round.match(/\d+/);
        roundVal = match ? parseInt(match[0], 10) : 1;
      } else {
        roundVal = parseInt(item.round, 10) || 1;
      }
    }
    return {
      ...item,
      member_id: sanitizeInt(item.member_id),
      round: roundVal,
      score: sanitizeInt(item.score),
      import_id: item.import_id !== undefined && item.import_id !== null ? sanitizeInt(item.import_id, null as any) : null
    };
  });
}

function mapOldFendaHistory(arr: any[]) {
  return arr.map(item => {
    let seasonVal = 1;
    if (item.season !== undefined && item.season !== null) {
      if (typeof item.season === 'string') {
        const match = item.season.match(/\d+/);
        seasonVal = match ? parseInt(match[0], 10) : 1;
      } else {
        seasonVal = parseInt(item.season, 10) || 1;
      }
    }
    let cryVal = BigInt(0);
    try {
      cryVal = item.crystals !== undefined && item.crystals !== null ? BigInt(item.crystals) : BigInt(0);
    } catch (_) {}
    return {
      ...item,
      member_id: sanitizeInt(item.member_id),
      crystals: cryVal,
      season: seasonVal,
      import_id: item.import_id !== undefined && item.import_id !== null ? sanitizeInt(item.import_id, null as any) : null
    };
  });
}

function mapOldAbsenceJustification(arr: any[]) {
  return arr.map(item => ({
    ...item,
    member_id: sanitizeInt(item.member_id),
  }));
}

/**
 * Resets SQLite auto-increment sequences after bulk manual inserts.
 */
async function resetSqliteSequences() {
  try {
    await prisma.$transaction(async (tx) => {
      const tables: any[] = await tx.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'prisma_%'");
      for (const table of tables) {
        const tableName = table.name;
        if (tableName === 'sqlite_sequence') continue;
        
        const maxIdRes: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as maxId FROM "${tableName}"`);
        const maxId = maxIdRes[0]?.maxId || 0;
        
        await tx.$executeRawUnsafe(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('${tableName}', ${maxId})`);
      }
    });
    console.log('[DB] SQLite sequences reset successfully.');
  } catch (e) {
    console.warn('[DB] Failed to reset SQLite sequences (this is normal if no sequences exist yet):', e);
  }
}

/**
 * Standardized security logging for fail2ban and monitoring.
 */
function logSecurityEvent(req: any, type: string, details: string) {
  // Robust IP detection for proxies
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || '0.0.0.0';
  
  const timestamp = new Date().toISOString();
  const logMessage = `[SECURITY_EVENT] [${timestamp}] [IP: ${ip}] [TYPE: ${type}] [METHOD: ${req.method}] [URL: ${req.originalUrl || req.url}] [DETAILS: ${details}]`;
  console.log(logMessage);
  
  // Write to file for fail2ban
  try {
    fs.appendFileSync(SECURITY_LOG_FILE, logMessage + '\n');
  } catch (e) {
    console.error('[FILE LOG ERROR] Failed to write to security.log:', e);
  }
  
  // Save to DB asynchronously to avoid blocking the request
  prisma.securityLog.create({
    data: {
      ip,
      type,
      method: req.method || 'UNKNOWN',
      url: req.originalUrl || req.url || 'UNKNOWN',
      details
    }
  }).catch(err => {
    // Graceful failure for logging, don't want to break the app if DB is busy
    console.error('[DB LOG ERROR] Failed to save security event:', err.message);
  });
}

/**
 * Robust database check and fix.
 * Detects corruption (malformed disk image) and handles missing records.
 */
const checkAndFixDatabase = async () => {
  const dbPath = getDbPath();

  // Check if DB exists, if not, try to push schema
  if (!fs.existsSync(dbPath)) {
    console.log('[DB CHECK] Database file missing. Running prisma db push...');
    try {
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
      console.log('[DB CHECK] Database initialized successfully.');
    } catch (err) {
      console.error('[DB CHECK] Failed to initialize database:', err);
    }
  }

  try {
    // 1. Connectivity check
    console.log('[DB CHECK] Verifying database connectivity...');
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    const errMsg = err.message || '';
    if (errMsg.includes('malformed') || errMsg.includes('database disk image is malformed')) {
      console.error('[DB CHECK] CRITICAL ERROR: Database file is malformed/corrupted.');
      triggerDatabaseRecovery();
    } else if (errMsg.includes('does not exist') || errMsg.includes('no such table')) {
      console.log('[DB CHECK] Tables missing. Attempting to sync schema...');
      try {
        execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
        console.log('[DB CHECK] Database schema synced successfully.');
      } catch (pushErr) {
        console.error('[DB CHECK] Failed to sync schema:', pushErr);
      }
    } else {
      console.error('[DB CHECK] Connection failed for unknown reason:', err);
    }
    return;
  }

  try {
    // 2. Data integrity: Ensure essential records exist (Complement and adjust)
    console.log('[DB CHECK] Running integrity and adjustment logic...');
    
    // Create default admin if no users exist at all
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[DB FIX] No users found. Creating default admin...');
      const hash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: { username: 'admin', password_hash: hash, role: 'admin' }
      });
    }

    // Ensure default settings exist
    const settingsToEnsure = [
      { key: 'fenda_season', value: '1' },
      { key: 'guild_name', value: 'Metal Slug Guild' }
    ];

    for (const setting of settingsToEnsure) {
      const exists = await prisma.setting.findUnique({ where: { key: setting.key } });
      if (!exists) {
        await prisma.setting.create({ data: setting });
        console.log(`[DB FIX] Added missing setting: ${setting.key}`);
      }
    }

    // Initialize default system roles if missing
    const defaultRoles = [
      {
        name: 'admin',
        permissions: {
          members: { view: true, import: true, edit: true, delete: true },
          fenda: { view: true, import: true, edit: true, delete: true },
          tournaments: { view: true, import: true, edit: true, delete: true },
          absences: { view: true, import: true, edit: true, delete: true },
          settings: { view: true, import: true, edit: true, delete: true }
        }
      },
      {
        name: 'user',
        permissions: {
          members: { view: true, import: false, edit: false, delete: false },
          fenda: { view: true, import: false, edit: false, delete: false },
          tournaments: { view: true, import: false, edit: false, delete: false },
          absences: { view: true, import: false, edit: false, delete: false },
          settings: { view: false, import: false, edit: false, delete: false }
        }
      }
    ];

    for (const roleDef of defaultRoles) {
      const exists = await prisma.systemRole.findUnique({ where: { name: roleDef.name } });
      if (!exists) {
        await prisma.systemRole.create({
          data: {
            name: roleDef.name,
            permissions: JSON.stringify(roleDef.permissions)
          }
        });
        console.log(`[DB FIX] Reconstructed missing role: ${roleDef.name}`);
      }
    }

    // Ensure at least one Rift Season if table is empty
    const seasonCount = await prisma.riftSeason.count();
    if (seasonCount === 0) {
      await prisma.riftSeason.create({
        data: {
          season_number: 1,
          closed_at: new Date().toISOString()
        }
      });
      console.log('[DB FIX] Created default Rift Season 1');
    }
    
    console.log('[DB CHECK] Database integrity check complete.');

  } catch (e) {
    console.error('[DB FIX] Error during database adjustment:', e);
  }
};

// Multer for CSV uploads
const upload = multer({ dest: UPLOADS_DIR });

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const requestedWith = req.headers['x-requested-with'];
    if (requestedWith !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'CSRF protection check failed' });
    }
  }

  const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const checkPermission = (areaOrFn: string | ((req: any) => string), requiredLevel: 'view' | 'edit' | 'full') => {
  return async (req: any, res: any, next: any) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });
      
      if (!user) return res.status(403).json({ error: 'Acesso negado' });
      
      const systemRole = await prisma.systemRole.findUnique({ where: { name: user.role } });
      if (!systemRole) return res.status(403).json({ error: 'Acesso negado' });
      
      const permissions = JSON.parse(systemRole.permissions);
      const area = typeof areaOrFn === 'function' ? areaOrFn(req) : areaOrFn;
      
      // Map upload types to permission areas
      let mappedArea = area;
      if (['guerra_total', 'torneio_celeste', 'pico_gloria'].includes(area)) {
        mappedArea = 'tournaments';
      }
      
      const userLevel = permissions[mappedArea] || 'none';
      
      if (userLevel === 'none') return res.status(403).json({ error: 'Acesso negado' });
      if (requiredLevel === 'full' && userLevel !== 'full') return res.status(403).json({ error: 'Acesso negado' });
      if (requiredLevel === 'edit' && userLevel !== 'edit' && userLevel !== 'full') return res.status(403).json({ error: 'Acesso negado' });
      
      next();
    } catch (e) {
      handlePrismaError(e, res);
    }
  };
};

// API Routes

// Auth
app.post('/api/auth/login', async (req, res) => {
  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'CSRF protection check failed' });
  }

  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user) {
      logSecurityEvent(req, 'LOGIN_FAILED', `User not found: ${username}`);
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }
    
    if (Boolean(user.is_blocked)) {
      logSecurityEvent(req, 'LOGIN_BLOCKED', `Blocked user attempted login: ${username}`);
      return res.status(403).json({ error: 'Usuário bloqueado' });
    }
    
    if (await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      // Fetch role permissions
      const systemRole = await prisma.systemRole.findUnique({ where: { name: user.role } });
      const permissions = systemRole ? JSON.parse(systemRole.permissions) : null;

      logSecurityEvent(req, 'LOGIN_SUCCESS', `User: ${username}`);
      res.json({ user: { id: user.id, username: user.username, role: user.role, permissions }, token });
    } else {
      logSecurityEvent(req, 'LOGIN_FAILED', `Incorrect password for user: ${username}`);
      res.status(400).json({ error: 'Senha incorreta' });
    }
  } catch (e) {
    handlePrismaError(e, res);
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (Boolean(user.is_blocked)) return res.status(403).json({ error: 'Usuário bloqueado' });
    
    const systemRole = await prisma.systemRole.findUnique({ where: { name: user.role } });
    const permissions = systemRole ? JSON.parse(systemRole.permissions) : null;
    
    res.json({ user: { id: user.id, username: user.username, role: user.role, permissions } });
  } catch (e) {
    handlePrismaError(e, res);
  }
});

app.post('/api/auth/register', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admins podem registrar usuários' });
  const { username, password, role = 'user' } = req.body;
  
  // Validate role
  const roleExists = await prisma.systemRole.findUnique({ where: { name: role } });
  if (!roleExists) return res.status(400).json({ error: 'Cargo inválido' });

  try {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { username, password_hash: hash, role }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Usuário já existe' });
  }
});

// --- System Roles API ---

app.get('/api/roles', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const roles = await prisma.systemRole.findMany();
  res.json(roles);
});

app.post('/api/roles', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { name, permissions } = req.body;
  if (!name || !permissions) return res.status(400).json({ error: 'Nome e permissões são obrigatórios' });
  
  try {
    const role = await prisma.systemRole.create({
      data: { name, permissions: JSON.stringify(permissions) }
    });
    res.json(role);
  } catch (e) {
    res.status(400).json({ error: 'Erro ao criar cargo. Nome pode já existir.' });
  }
});

app.put('/api/roles/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { name, permissions } = req.body;
  const id = parseInt(req.params.id);
  
  try {
    const role = await prisma.systemRole.update({
      where: { id },
      data: { name, permissions: JSON.stringify(permissions) }
    });
    res.json(role);
  } catch (e) {
    res.status(400).json({ error: 'Erro ao atualizar cargo.' });
  }
});

app.delete('/api/roles/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const id = parseInt(req.params.id);
  
  try {
    const role = await prisma.systemRole.findUnique({ where: { id } });
    if (role?.name === 'admin' || role?.name === 'user') {
      return res.status(400).json({ error: 'Não é possível excluir cargos padrão' });
    }
    
    // Check if any users have this role
    const usersWithRole = await prisma.user.count({ where: { role: role?.name } });
    if (usersWithRole > 0) {
      return res.status(400).json({ error: 'Não é possível excluir um cargo que está em uso por usuários' });
    }

    await prisma.systemRole.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Erro ao excluir cargo.' });
  }
});

app.get('/api/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, is_blocked: true }
  });
  res.json(users);
});

app.post('/api/users/:id/block', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { blocked } = req.body;
  await prisma.user.update({
    where: { id: parseInt(req.params.id) },
    data: { is_blocked: blocked ? 1 : 0 }
  });
  res.json({ success: true });
});

app.post('/api/users/:id/role', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { role } = req.body;
  
  const roleExists = await prisma.systemRole.findUnique({ where: { name: role } });
  if (!roleExists) return res.status(400).json({ error: 'Cargo inválido' });
  
  if (role !== 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (targetUser && targetUser.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Não é possível remover o último administrador' });
    }
  }
  
  await prisma.user.update({
    where: { id: parseInt(req.params.id) },
    data: { role }
  });
  res.json({ success: true });
});

app.post('/api/users/:id/reset-password', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { newPassword } = req.body;
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: parseInt(req.params.id) },
    data: { password_hash: hash }
  });
  res.json({ success: true });
});

app.delete('/api/users/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  try {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (targetUser && targetUser.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Não é possível excluir o último administrador' });
    }
    
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Security Logs Management
app.get('/api/admin/security-logs', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  try {
    const logs = await prisma.securityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
    
    const total = await prisma.securityLog.count();
    
    res.json({ logs, total });
  } catch (e) {
    handlePrismaError(e, res);
  }
});

app.delete('/api/admin/security-logs', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  try {
    await prisma.securityLog.deleteMany({});
    logSecurityEvent(req, 'LOGS_CLEARED', `Admin ${req.user.username} cleared security logs`);
    res.json({ success: true });
  } catch (e) {
    handlePrismaError(e, res);
  }
});

app.post('/api/admin/sql', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    logSecurityEvent(req, 'UNAUTHORIZED_SQL_ATTEMPT', `User: ${req.user.username}`);
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  
  logSecurityEvent(req, 'ADMIN_SQL_QUERY', `User: ${req.user.username} | Query: ${query.substring(0, 100)}...`);
  
  try {
    const isSelect = query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().startsWith('PRAGMA');
    if (isSelect) {
      const results = await prisma.$queryRawUnsafe(query);
      
      // Convert BigInt to string for JSON serialization
      const serializedResults = Array.isArray(results) ? results.map((row: any) => {
        const newRow: any = {};
        for (const key in row) {
          newRow[key] = typeof row[key] === 'bigint' ? row[key].toString() : row[key];
        }
        return newRow;
      }) : results;
      
      res.json({ results: serializedResults });
    } else {
      const info = await prisma.$executeRawUnsafe(query);
      res.json({ results: [{ changes: info }], message: 'Query executada com sucesso.' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/tables', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    // Note: This query is specific to SQLite. If migrating to Postgres/MySQL, this needs adjusting.
    // For a generic approach, we'd need to check the provider, but since we are prepping for migration,
    // we'll keep the SQLite query for now as the current DB is SQLite.
    // A more robust way for Prisma would be to read the Prisma schema, but this is a raw DB explorer.
    const tables: any[] = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    res.json(tables.map((t: any) => t.name));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/tables/:name/schema', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  if (!isValidTableName(req.params.name)) {
    logSecurityEvent(req, 'SQL_INJECTION_ATTEMPT', `Invalid table name in schema: ${req.params.name}`);
    return res.status(400).json({ error: 'Nome de tabela inválido' });
  }
  try {
    // Correctly using Prisma's raw query with parameterization where possible, 
    // but PRAGMA table_info doesn't support placeholders in SQLite usually.
    // Whitelist check above makes it safe.
    const schema = await prisma.$queryRawUnsafe(`PRAGMA table_info(${req.params.name})`);
    res.json(schema);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/tables/:name/data', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  if (!isValidTableName(req.params.name)) {
    logSecurityEvent(req, 'SQL_INJECTION_ATTEMPT', `Invalid table name in data: ${req.params.name}`);
    return res.status(400).json({ error: 'Nome de tabela inválido' });
  }
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  try {
    const tables: any[] = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map((t: any) => t.name);
    if (!tableNames.includes(req.params.name)) {
      return res.status(404).json({ error: 'Tabela não encontrada' });
    }
    
    const data: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ${req.params.name} LIMIT ${limit} OFFSET ${offset}`);
    const countRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${req.params.name}`);
    
    const serializedData = data.map((row: any) => {
      const newRow: any = {};
      for (const key in row) {
        newRow[key] = typeof row[key] === 'bigint' ? row[key].toString() : row[key];
      }
      return newRow;
    });
    
    res.json({ data: serializedData, total: Number(countRes[0].count) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/db/download', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  res.download(getDbPath(), `guild_backup_${new Date().toISOString().split('T')[0]}.db`);
});

app.post('/api/admin/db/backup', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `guild_backup_${timestamp}.db`;
    fs.copyFileSync(getDbPath(), path.join(BACKUPS_DIR, backupName));
    res.json({ success: true, message: 'Backup criado com sucesso', filename: backupName });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/db/backups', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db'));
    const backups = files.map(f => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        filename: f,
        size: stats.size,
        createdAt: stats.mtime
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(backups);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/db/restore/:filename', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const filename = path.basename(req.params.filename);
    const backupPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }
    
    // Disconnect Prisma before replacing the file
    await prisma.$disconnect();
    fs.copyFileSync(backupPath, getDbPath());
    // Reconnect Prisma
    await prisma.$connect();
    await checkAndFixDatabase();
    res.json({ success: true, message: 'Backup restaurado com sucesso' });
  } catch (e: any) {
    await prisma.$connect(); // Try to reconnect in case of error
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/db/upload-restore', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  
  try {
    const dbPath = getDbPath();
    // Disconnect Prisma before replacing the file
    await prisma.$disconnect();
    fs.copyFileSync(req.file.path, dbPath);
    // Reconnect Prisma
    await prisma.$connect();
    await checkAndFixDatabase();
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: 'Banco de dados restaurado com sucesso' });
  } catch (e: any) {
    await prisma.$connect(); // Try to reconnect in case of error
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/db/export', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const data = {
      users: await prisma.user.findMany(),
      settings: await prisma.setting.findMany(),
      members: await prisma.member.findMany(),
      member_roles: await prisma.memberRole.findMany(),
      power_history: await prisma.powerHistory.findMany(),
      guerra_total: await prisma.guerraTotal.findMany(),
      torneio_celeste: await prisma.torneioCeleste.findMany(),
      pico_gloria: await prisma.picoGloria.findMany(),
      fenda_history: await prisma.fendaHistory.findMany(),
      rift_seasons: await prisma.riftSeason.findMany(),
      absence_justifications: await prisma.absenceJustification.findMany(),
      imports: await prisma.import.findMany(),
      stored_csvs: await prisma.storedCsv.findMany(),
      system_roles: await prisma.systemRole.findMany(),
    };
    
    // Convert BigInt to string
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
          result[key] = serializeBigInt(obj[key]);
        }
        return result;
      }
      return obj;
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=database_export.json');
    res.send(JSON.stringify(serializeBigInt(data), null, 2));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/db/import', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Delete all existing data first (in reverse order of dependencies)
    await prisma.$transaction([
      prisma.securityLog.deleteMany(),
      prisma.absenceJustification.deleteMany(),
      prisma.fendaHistory.deleteMany(),
      prisma.picoGloria.deleteMany(),
      prisma.torneioCeleste.deleteMany(),
      prisma.guerraTotal.deleteMany(),
      prisma.powerHistory.deleteMany(),
      prisma.memberRole.deleteMany(),
      prisma.member.deleteMany(),
      prisma.storedCsv.deleteMany(),
      prisma.import.deleteMany(),
      prisma.riftSeason.deleteMany(),
      prisma.setting.deleteMany(),
      prisma.systemRole.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    // Data format helper to support both camelCase and snake_case
    const getData = (keyCamel: string, keySnake: string) => data[keyCamel] || data[keySnake] || [];

    // Import data in correct dependency order
    const systemRoles = getData('systemRoles', 'system_roles');
    if (systemRoles.length > 0) await prisma.systemRole.createMany({ data: systemRoles });

    const users = getData('users', 'users');
    if (users.length > 0) await prisma.user.createMany({ data: mapOldUsers(users) });

    const settings = getData('settings', 'settings');
    if (settings.length > 0) await prisma.setting.createMany({ data: settings });

    const imports = getData('imports', 'imports');
    if (imports.length > 0) {
      // Map back timestamps if they are strings
      const importsMapped = imports.map((i: any) => ({
        ...i,
        created_at: i.created_at ? new Date(i.created_at) : new Date()
      }));
      await prisma.import.createMany({ data: importsMapped });
    }

    const riftSeasons = getData('riftSeasons', 'rift_seasons');
    if (riftSeasons.length > 0) await prisma.riftSeason.createMany({ data: mapOldRiftSeasons(riftSeasons) });
    
    const members = getData('members', 'members');
    if (members.length > 0) await prisma.member.createMany({ data: members });
    
    const memberRoles = getData('memberRoles', 'member_roles');
    if (memberRoles.length > 0) await prisma.memberRole.createMany({ data: mapOldMemberRoles(memberRoles) });

    const powerHistory = getData('powerHistory', 'power_history');
    if (powerHistory.length > 0) {
      await prisma.powerHistory.createMany({ data: mapOldPowerHistory(powerHistory) });
    }

    const guerraTotal = getData('guerraTotal', 'guerra_total');
    if (guerraTotal.length > 0) {
      await prisma.guerraTotal.createMany({ data: mapOldGuerraTotal(guerraTotal) });
    }

    const torneioCeleste = getData('torneioCeleste', 'torneio_celeste');
    if (torneioCeleste.length > 0) await prisma.torneioCeleste.createMany({ data: mapOldTorneioCeleste(torneioCeleste) });

    const picoGloria = getData('picoGloria', 'pico_gloria');
    if (picoGloria.length > 0) await prisma.picoGloria.createMany({ data: mapOldPicoGloria(picoGloria) });

    const fendaHistory = getData('fendaHistory', 'fenda_history');
    if (fendaHistory.length > 0) {
      await prisma.fendaHistory.createMany({ data: mapOldFendaHistory(fendaHistory) });
    }

    const absenceJustifications = getData('absenceJustifications', 'absence_justifications');
    if (absenceJustifications.length > 0) await prisma.absenceJustification.createMany({ data: mapOldAbsenceJustification(absenceJustifications) });

    const storedCSVs = getData('storedCsvs', 'stored_csvs');
    if (storedCSVs.length > 0) {
      const storedCSVsMapped = storedCSVs.map((c: any) => ({
        ...c,
        created_at: c.created_at ? new Date(c.created_at) : new Date()
      }));
      await prisma.storedCsv.createMany({ data: storedCSVsMapped });
    }
    
    await resetSqliteSequences();
    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: 'Dados importados com sucesso' });
  } catch (e: any) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: e.message });
  }
});

// Members
app.get('/api/members', authenticateToken, checkPermission('members', 'view'), async (req, res) => {
  const members = await prisma.member.findMany({
    include: {
      memberRoles: {
        where: { end_date: null },
        orderBy: { start_date: 'desc' },
        take: 1
      },
      powerHistory: {
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  });

  const formattedMembers = members.map(m => ({
    ...m,
    role: m.memberRoles.length > 0 ? m.memberRoles[0].role : 'Membro',
    power: m.powerHistory.length > 0 ? m.powerHistory[0].power.toString() : 0,
    memberRoles: undefined,
    powerHistory: undefined
  }));

  res.json(formattedMembers);
});

app.post('/api/members', authenticateToken, checkPermission('members', 'edit'), async (req, res) => {
  const { nick, entry_date } = req.body;
  try {
    const result = await prisma.member.create({
      data: { nick, entry_date }
    });
    res.json({ id: result.id });
  } catch (e) {
    res.status(400).json({ error: 'Membro já existe' });
  }
});

app.put('/api/members/:id', authenticateToken, checkPermission('members', 'edit'), async (req, res) => {
  const { status, exit_date } = req.body;
  await prisma.member.update({
    where: { id: parseInt(req.params.id) },
    data: { status, exit_date }
  });
  res.json({ success: true });
});

app.get('/api/members/:id/roles', authenticateToken, checkPermission('members', 'view'), async (req, res) => {
  const roles = await prisma.memberRole.findMany({
    where: { member_id: parseInt(req.params.id) },
    orderBy: { start_date: 'desc' }
  });
  res.json(roles);
});

app.post('/api/members/:id/roles', authenticateToken, checkPermission('members', 'edit'), async (req, res) => {
  const { role, start_date } = req.body;
  const memberId = parseInt(req.params.id);
  
  await prisma.$transaction([
    prisma.memberRole.updateMany({
      where: { member_id: memberId, end_date: null },
      data: { end_date: start_date }
    }),
    prisma.memberRole.create({
      data: { member_id: memberId, role, start_date }
    })
  ]);
  
  res.json({ success: true });
});

app.delete('/api/members/:id', authenticateToken, checkPermission('members', 'full'), async (req: any, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.$transaction([
      prisma.powerHistory.deleteMany({ where: { member_id: id } }),
      prisma.guerraTotal.deleteMany({ where: { member_id: id } }),
      prisma.torneioCeleste.deleteMany({ where: { member_id: id } }),
      prisma.picoGloria.deleteMany({ where: { member_id: id } }),
      prisma.fendaHistory.deleteMany({ where: { member_id: id } }),
      prisma.memberRole.deleteMany({ where: { member_id: id } }),
      prisma.absenceJustification.deleteMany({ where: { member_id: id } }),
      prisma.member.delete({ where: { id } })
    ]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Power History
app.get('/api/power/compare', authenticateToken, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Datas start e end são obrigatórias' });

  const data = await prisma.$queryRaw`
    SELECT 
      m.nick,
      m.status,
      COALESCE((SELECT role FROM MemberRole WHERE member_id = m.id AND end_date IS NULL ORDER BY start_date DESC LIMIT 1), 'Membro') as role,
      COALESCE(MAX(CASE WHEN p.date = ${start} THEN p.power END), 0) as start_power,
      COALESCE(MAX(CASE WHEN p.date = ${end} THEN p.power END), 0) as end_power
    FROM Member m
    LEFT JOIN PowerHistory p ON m.id = p.member_id AND p.date IN (${start}, ${end})
    GROUP BY m.id
    HAVING start_power > 0 OR end_power > 0
  `;
  
  // Convert BigInt to string for JSON serialization
  const serializedData = (data as any[]).map(row => ({
    ...row,
    start_power: row.start_power.toString(),
    end_power: row.end_power.toString()
  }));

  res.json(serializedData);
});

app.get('/api/power', authenticateToken, async (req, res) => {
  const history = await prisma.$queryRaw`
    SELECT p.*, m.nick, m.status,
           COALESCE((SELECT role FROM MemberRole WHERE member_id = m.id AND end_date IS NULL ORDER BY start_date DESC LIMIT 1), 'Membro') as role
    FROM PowerHistory p 
    JOIN Member m ON p.member_id = m.id 
    ORDER BY p.date DESC
  `;
  
  const serializedHistory = (history as any[]).map(row => ({
    ...row,
    power: row.power.toString()
  }));

  res.json(serializedHistory);
});

app.delete('/api/power/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await prisma.powerHistory.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/power/date/:date', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await prisma.powerHistory.deleteMany({ where: { date: req.params.date } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Tournaments
app.get('/api/tournaments/:type/compare', authenticateToken, checkPermission('tournaments', 'view'), async (req, res) => {
  const { type } = req.params;
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Datas start e end são obrigatórias' });

  const validTypes = ['guerra_total', 'torneio_celeste', 'pico_gloria'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

  const valueColumn = type === 'guerra_total' ? 'power' : 'score';

  // Using raw query for dynamic table name
  const data = await prisma.$queryRawUnsafe(`
    SELECT 
      m.nick,
      m.status,
      COALESCE(MAX(CASE WHEN t.date = $1 THEN t.${valueColumn} END), 0) as start_value,
      COALESCE(MAX(CASE WHEN t.date = $2 THEN t.${valueColumn} END), 0) as end_value
    FROM members m
    LEFT JOIN ${type} t ON m.id = t.member_id AND t.date IN ($1, $2)
    GROUP BY m.id
    HAVING start_value > 0 OR end_value > 0
  `, start, end);
  
  const serializedData = (data as any[]).map(row => ({
    ...row,
    start_value: typeof row.start_value === 'bigint' ? row.start_value.toString() : row.start_value,
    end_value: typeof row.end_value === 'bigint' ? row.end_value.toString() : row.end_value
  }));

  res.json(serializedData);
});

app.get('/api/tournaments/guerra_total', authenticateToken, checkPermission('tournaments', 'view'), async (req, res) => {
  const data = await prisma.guerraTotal.findMany({
    include: { member: { select: { nick: true, status: true } } },
    orderBy: { date: 'desc' }
  });
  const serializedData = data.map(row => ({
    ...row,
    power: row.power.toString(),
    nick: row.member.nick,
    status: row.member.status,
    member: undefined
  }));
  res.json(serializedData);
});

app.get('/api/tournaments/torneio_celeste', authenticateToken, checkPermission('tournaments', 'view'), async (req, res) => {
  const data = await prisma.torneioCeleste.findMany({
    include: { member: { select: { nick: true, status: true } } },
    orderBy: { date: 'desc' }
  });
  const serializedData = data.map(row => ({
    ...row,
    nick: row.member.nick,
    status: row.member.status,
    member: undefined
  }));
  res.json(serializedData);
});

app.get('/api/tournaments/pico_gloria', authenticateToken, checkPermission('tournaments', 'view'), async (req, res) => {
  const data = await prisma.picoGloria.findMany({
    include: { member: { select: { nick: true, status: true } } },
    orderBy: { date: 'desc' }
  });
  const serializedData = data.map(row => ({
    ...row,
    nick: row.member.nick,
    status: row.member.status,
    member: undefined
  }));
  res.json(serializedData);
});

app.delete('/api/tournaments/:type/:id', authenticateToken, checkPermission('tournaments', 'full'), async (req: any, res) => {
  const type = req.params.type;
  const id = parseInt(req.params.id);
  
  try {
    if (type === 'guerra_total') await prisma.guerraTotal.delete({ where: { id } });
    else if (type === 'torneio_celeste') await prisma.torneioCeleste.delete({ where: { id } });
    else if (type === 'pico_gloria') await prisma.picoGloria.delete({ where: { id } });
    else return res.status(400).json({ error: 'Tipo inválido' });
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tournaments/:type/date/:date', authenticateToken, checkPermission('tournaments', 'full'), async (req: any, res) => {
  const type = req.params.type;
  const date = req.params.date;
  
  try {
    if (type === 'guerra_total') await prisma.guerraTotal.deleteMany({ where: { date } });
    else if (type === 'torneio_celeste') await prisma.torneioCeleste.deleteMany({ where: { date } });
    else if (type === 'pico_gloria') await prisma.picoGloria.deleteMany({ where: { date } });
    else return res.status(400).json({ error: 'Tipo inválido' });
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Fenda
app.get('/api/fenda/compare', authenticateToken, async (req, res) => {
  const { start, end, season } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Datas start e end são obrigatórias' });

  let query = `
    SELECT 
      m.nick,
      m.status,
      COALESCE(MAX(CASE WHEN f.date = $1 THEN f.crystals END), 0) as start_value,
      COALESCE(MAX(CASE WHEN f.date = $2 THEN f.crystals END), 0) as end_value
    FROM members m
    LEFT JOIN fenda_history f ON m.id = f.member_id AND f.date IN ($1, $2)
  `;
  
  const params: any[] = [start, end];
  
  if (season) {
    query += ` AND f.season = $3 `;
    params.push(parseInt(season as string));
  }
  
  query += `
    GROUP BY m.id
    HAVING start_value > 0 OR end_value > 0
  `;

  const data = await prisma.$queryRawUnsafe(query, ...params);
  
  const serializedData = (data as any[]).map(row => ({
    ...row,
    start_value: typeof row.start_value === 'bigint' ? row.start_value.toString() : row.start_value,
    end_value: typeof row.end_value === 'bigint' ? row.end_value.toString() : row.end_value
  }));

  res.json(serializedData);
});

app.get('/api/fenda', authenticateToken, checkPermission('fenda', 'view'), async (req, res) => {
  const seasonRow = await prisma.setting.findUnique({ where: { key: 'fenda_season' } });
  const currentSeason = parseInt(seasonRow?.value || '1', 10);
  const requestedSeason = req.query.season ? parseInt(req.query.season as string, 10) : currentSeason;
  
  const data = await prisma.fendaHistory.findMany({
    where: { season: requestedSeason },
    include: { member: { select: { nick: true, status: true } } },
    orderBy: { crystals: 'desc' }
  });
  
  const serializedData = data.map(row => ({
    ...row,
    crystals: row.crystals.toString(),
    nick: row.member.nick,
    status: row.member.status,
    member: undefined
  }));
  
  res.json({ season: requestedSeason, currentSeason, data: serializedData });
});

app.get('/api/fenda/seasons', authenticateToken, checkPermission('fenda', 'view'), async (req, res) => {
  const seasons = await prisma.riftSeason.findMany({
    orderBy: { season_number: 'desc' }
  });
  res.json(seasons);
});

app.post('/api/fenda/close', authenticateToken, checkPermission('fenda', 'full'), async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Data de fechamento é obrigatória' });
  
  const seasonRow = await prisma.setting.findUnique({ where: { key: 'fenda_season' } });
  const currentSeason = parseInt(seasonRow?.value || '1', 10);
  
  await prisma.$transaction([
    prisma.riftSeason.create({
      data: { season_number: currentSeason, closed_at: date }
    }),
    prisma.setting.upsert({
      where: { key: 'fenda_season' },
      update: { value: (currentSeason + 1).toString() },
      create: { key: 'fenda_season', value: (currentSeason + 1).toString() }
    })
  ]);
  
  res.json({ success: true });
});

app.post('/api/fenda/reopen', authenticateToken, checkPermission('fenda', 'full'), async (req: any, res) => {
  const { season_number } = req.body;
  
  if (season_number) {
    const sn = parseInt(season_number);
    await prisma.$transaction([
      prisma.riftSeason.delete({ where: { season_number: sn } }),
      prisma.setting.upsert({
        where: { key: 'fenda_season' },
        update: { value: sn.toString() },
        create: { key: 'fenda_season', value: sn.toString() }
      })
    ]);
  } else {
    const seasonRow = await prisma.setting.findUnique({ where: { key: 'fenda_season' } });
    const currentSeason = parseInt(seasonRow?.value || '1', 10);
    if (currentSeason > 1) {
      const prevSeason = currentSeason - 1;
      await prisma.$transaction([
        prisma.riftSeason.delete({ where: { season_number: prevSeason } }),
        prisma.setting.upsert({
          where: { key: 'fenda_season' },
          update: { value: prevSeason.toString() },
          create: { key: 'fenda_season', value: prevSeason.toString() }
        })
      ]);
    }
  }
  
  res.json({ success: true });
});

app.delete('/api/fenda/:id', authenticateToken, checkPermission('fenda', 'full'), async (req: any, res) => {
  try {
    await prisma.fendaHistory.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/fenda/date/:date', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await prisma.fendaHistory.deleteMany({ where: { date: req.params.date } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// CSV Uploads
function parseDateStr(d: string | undefined | null, fallback: string) {
  if (!d) return fallback;
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      // Assume DD/MM/YYYY
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return d;
}

app.post('/api/upload/:type/preview', authenticateToken, checkPermission(req => req.params.type, 'full'), upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  
  const shouldStore = req.body.store === 'true';
  const type = req.params.type;

  if (shouldStore) {
    const newFilename = `${Date.now()}-${req.file.originalname}`;
    const newPath = path.join(CSV_STORAGE_DIR, newFilename);
    fs.copyFileSync(req.file.path, newPath);
    await prisma.storedCsv.create({
      data: { filename: newFilename, original_name: req.file.originalname, type }
    });
  }

  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, trim: true, bom: true, delimiter: [',', ';'] }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      fs.unlinkSync(req.file!.path);
      
      const unknownNicks = new Set<string>();
      
      for (const row of results) {
        const nick = row.Nick || row.nick || row.NICK;
        if (nick) {
          const member = await prisma.member.findUnique({ where: { nick } });
          if (!member) {
            unknownNicks.add(nick);
          }
        }
      }
      
      res.json({ 
        results, 
        unknownNicks: Array.from(unknownNicks)
      });
    });
});

// Stored CSVs
app.get('/api/stored-csvs', authenticateToken, async (req, res) => {
  const csvs = await prisma.storedCsv.findMany({
    orderBy: { created_at: 'desc' }
  });
  res.json(csvs);
});

app.get('/api/stored-csvs/:id/download', authenticateToken, async (req, res) => {
  const csv = await prisma.storedCsv.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!csv) return res.status(404).json({ error: 'Arquivo não encontrado' });
  
  const filePath = path.join(CSV_STORAGE_DIR, csv.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo físico não encontrado' });
  
  res.download(filePath, csv.original_name);
});

app.delete('/api/stored-csvs/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const csv = await prisma.storedCsv.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!csv) return res.status(404).json({ error: 'Arquivo não encontrado' });
  
  const filePath = path.join(CSV_STORAGE_DIR, csv.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  await prisma.storedCsv.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

app.post('/api/stored-csvs/upload', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  if (req.user.role !== 'admin') {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const type = req.body.type;
  if (!type) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Tipo não informado' });
  }

  const newFilename = `${Date.now()}-${req.file.originalname}`;
  const newPath = path.join(CSV_STORAGE_DIR, newFilename);
  fs.copyFileSync(req.file.path, newPath);
  fs.unlinkSync(req.file.path);

  await prisma.storedCsv.create({
    data: { filename: newFilename, original_name: req.file.originalname, type }
  });
  res.json({ success: true });
});

app.get('/api/stored-csvs/:id/preview', authenticateToken, async (req, res) => {
  const csv = await prisma.storedCsv.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!csv) return res.status(404).json({ error: 'Arquivo não encontrado' });
  
  const filePath = path.join(CSV_STORAGE_DIR, csv.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo físico não encontrado' });
  
  const results: any[] = [];
  fs.createReadStream(filePath)
    .pipe(parse({ columns: true, trim: true, bom: true, delimiter: [',', ';'] }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      const unknownNicks = new Set<string>();
      
      for (const row of results) {
        const nick = row.Nick || row.nick || row.NICK;
        if (nick) {
          const member = await prisma.member.findUnique({ where: { nick } });
          if (!member) {
            unknownNicks.add(nick);
          }
        }
      }
      
      res.json({ 
        results, 
        unknownNicks: Array.from(unknownNicks)
      });
    });
});

app.post('/api/upload/:type', authenticateToken, checkPermission(req => req.params.type, 'full'), async (req: any, res) => {
  const type = req.params.type;
  const { results, mappings } = req.body;
  
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }
  
  try {
    let importedCount = 0;
    
    await prisma.$transaction(async (tx) => {
      const importDate = new Date().toISOString().split('T')[0];
      const importResult = await tx.import.create({
        data: { user_id: req.user.id, type, date: importDate }
      });
      const importId = importResult.id;

      for (const row of results) {
        const nick = row.Nick || row.nick || row.NICK;
        if (!nick) continue;
        
        const mapping = mappings ? mappings[nick] : null;
        let memberId: number | null = null;

        if (mapping) {
          if (mapping.action === 'ignore') continue;
          if (mapping.action === 'associate') {
            memberId = mapping.memberId;
          } else if (mapping.action === 'new') {
            const rawDate = row.Date || row.date || row.Data || row.data || row.DATA;
            const entryDate = parseDateStr(rawDate, importDate);
            const newMember = await tx.member.create({
              data: { nick, entry_date: entryDate, import_id: importId }
            });
            memberId = newMember.id;
          }
        } else {
          // Default behavior: ensure member exists
          const rawDate = row.Date || row.date || row.Data || row.data || row.DATA;
          const entryDate = parseDateStr(rawDate, importDate);
          
          let member = await tx.member.findUnique({ where: { nick } });
          if (!member) {
            member = await tx.member.create({
              data: { nick, entry_date: entryDate, import_id: importId }
            });
          }
          memberId = member.id;
        }

        if (!memberId) continue;
        
        const rawDate = row.Date || row.date || row.Data || row.data || row.DATA;
        const entryDate = parseDateStr(rawDate, importDate);

        if (type === 'members') {
          // Just members
        } else if (type === 'power') {
          await tx.powerHistory.create({
            data: {
              member_id: memberId,
              power: parseInt(row.Power || row.power || row.Poder || row.poder || row.PODER || '0', 10),
              date: entryDate,
              import_id: importId
            }
          });
        } else if (type === 'guerra_total') {
          await tx.guerraTotal.create({
            data: {
              member_id: memberId,
              power: parseInt(row.Power || row.power || row.Poder || row.poder || row.PODER || '0', 10),
              date: entryDate,
              import_id: importId
            }
          });
        } else if (type === 'torneio_celeste') {
          await tx.torneioCeleste.create({
            data: {
              member_id: memberId,
              guild: row.Guild || row.guild || row.GUILD || '',
              score: parseInt(row.Score || row.score || row.Pontuacao || row.pontuacao || row.PONTUACAO || '0', 10),
              field: (row.Field || row.field || row.Campo || row.campo || row.CAMPO || '0').toString(),
              date: entryDate,
              import_id: importId
            }
          });
        } else if (type === 'pico_gloria') {
          const team = row.Team || row.team || row.Time || row.time || row.TIME || 'Livre';
          await tx.picoGloria.create({
            data: {
              member_id: memberId,
              round: parseInt(row.Round || row.round || row.Rodada || row.rodada || row.RODADA || '0', 10),
              score: parseInt(row.Score || row.score || row.Pontuacao || row.pontuacao || row.PONTUACAO || '0', 10),
              team,
              date: entryDate,
              import_id: importId
            }
          });
        } else if (type === 'fenda') {
          const seasonRow = await tx.setting.findUnique({ where: { key: 'fenda_season' } });
          const season = parseInt(seasonRow?.value || '1', 10);
          const crystals = row.Crystals || row.crystals || row.Cristais || row.cristais || row.CRISTAIS;
          if (crystals) {
            await tx.fendaHistory.create({
              data: {
                member_id: memberId,
                crystals: parseInt(crystals, 10),
                date: entryDate,
                season,
                import_id: importId
              }
            });
          }
        }
        importedCount++;
      }
    });
    
    res.json({ success: true, count: importedCount });
  } catch (e: any) {
    res.status(500).json({ error: 'Erro ao processar importação: ' + e.message });
  }
});

// Imports History
app.get('/api/imports', authenticateToken, async (req, res) => {
  const imports = await prisma.import.findMany({
    orderBy: { created_at: 'desc' }
  });
  
  // We need to fetch usernames separately or use a raw query if we want to join with users
  // Since we only have user_id in Import, let's fetch users and map them
  const userIds = [...new Set(imports.map(i => i.user_id))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true }
  });
  
  const userMap = new Map(users.map(u => [u.id, u.username]));
  
  const serializedImports = imports.map(i => ({
    ...i,
    username: userMap.get(i.user_id) || 'Desconhecido'
  }));
  
  res.json(serializedImports);
});

app.delete('/api/imports/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const id = parseInt(req.params.id);
  
  try {
    // Note: Prisma doesn't support deleting by a non-unique foreign key directly in a single transaction array
    // if the relation isn't explicitly defined with onDelete: Cascade in the schema.
    // We'll use deleteMany for each table.
    await prisma.$transaction([
      prisma.powerHistory.deleteMany({ where: { import_id: id } } as any),
      prisma.guerraTotal.deleteMany({ where: { import_id: id } } as any),
      prisma.torneioCeleste.deleteMany({ where: { import_id: id } } as any),
      prisma.picoGloria.deleteMany({ where: { import_id: id } } as any),
      prisma.fendaHistory.deleteMany({ where: { import_id: id } } as any),
      prisma.member.deleteMany({ where: { import_id: id } } as any),
      prisma.import.delete({ where: { id } })
    ]);
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Absences (Faltas)
app.get('/api/absences', authenticateToken, checkPermission('absences', 'view'), async (req, res) => {
  const allMembers = await prisma.member.findMany({
    select: { id: true, nick: true, status: true, entry_date: true }
  });
  
  // Get all unique dates from tournaments
  const datesGT = await prisma.guerraTotal.findMany({ select: { date: true }, distinct: ['date'] });
  const datesTC = await prisma.torneioCeleste.findMany({ select: { date: true }, distinct: ['date'] });
  const datesPG = await prisma.picoGloria.findMany({ select: { date: true }, distinct: ['date'] });
  
  // Get all justifications
  const allJustifications = await prisma.absenceJustification.findMany();
  
  // Get all participations to avoid N+1 queries
  const participationsGT = await prisma.guerraTotal.findMany({ select: { member_id: true, date: true } });
  const participationsTC = await prisma.torneioCeleste.findMany({ select: { member_id: true, date: true } });
  const participationsPG = await prisma.picoGloria.findMany({ select: { member_id: true, date: true } });

  const hasParticipated = (participations: any[], memberId: number, date: string) => {
    return participations.some(p => p.member_id === memberId && p.date === date);
  };

  const absences = allMembers.map(m => {
    const missedDates: { date: string, tournament_type: string, justification?: any }[] = [];
    
    const checkMissed = (dates: any[], tournamentType: string, participations: any[]) => {
      for (const d of dates) {
        if (d.date < m.entry_date) continue;
        const participated = hasParticipated(participations, m.id, d.date);
        if (!participated) {
          const justification = allJustifications.find(j => j.member_id === m.id && j.date === d.date && j.tournament_type === tournamentType);
          missedDates.push({ date: d.date, tournament_type: tournamentType, justification });
        }
      }
    };

    checkMissed(datesGT, 'guerra_total', participationsGT);
    checkMissed(datesTC, 'torneio_celeste', participationsTC);
    checkMissed(datesPG, 'pico_gloria', participationsPG);
    
    const totals = {
      total: missedDates.length,
      abonado: missedDates.filter(d => d.justification?.type === 'Abonado').length,
      observacao: missedDates.filter(d => d.justification?.type === 'Em Observação').length,
      injustificada: missedDates.filter(d => !d.justification).length
    };
    
    return { 
      member_id: m.id,
      nick: m.nick, 
      status: m.status, 
      absences: totals.total,
      totals,
      missedDates: missedDates.sort((a, b) => b.date.localeCompare(a.date))
    };
  });
  
  res.json(absences.filter(a => a.absences > 0).sort((a, b) => b.absences - a.absences));
});

app.post('/api/absences/justification', authenticateToken, checkPermission('absences', 'edit'), async (req: any, res) => {
  const { member_id, date, tournament_type, type, note } = req.body;
  
  try {
    // Prisma doesn't have a direct equivalent to ON CONFLICT DO UPDATE for compound unique keys without a defined unique constraint
    // We'll use findFirst and then update or create
    const existing = await prisma.absenceJustification.findFirst({
      where: { member_id, date, tournament_type }
    });

    if (existing) {
      await prisma.absenceJustification.update({
        where: { id: existing.id },
        data: { type, note }
      });
    } else {
      await prisma.absenceJustification.create({
        data: { member_id, date, tournament_type, type, note }
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/absences/justification', authenticateToken, checkPermission('absences', 'edit'), async (req: any, res) => {
  const { member_id, date, tournament_type } = req.body;
  
  try {
    await prisma.absenceJustification.deleteMany({
      where: { member_id, date, tournament_type }
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/members/:id/nick', authenticateToken, checkPermission('members', 'edit'), async (req: any, res) => {
  const { nick } = req.body;
  const id = parseInt(req.params.id);
  
  if (!nick) return res.status(400).json({ error: 'Nick é obrigatório' });
  
  try {
    await prisma.member.update({
      where: { id },
      data: { nick }
    });
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2002') { // Prisma unique constraint violation code
      return res.status(400).json({ error: 'Este nick já está em uso por outro membro' });
    }
    res.status(500).json({ error: e.message });
  }
});

// --- High-Level Data Migration API (SQLite) ---

app.post('/api/admin/db/import-sqlite', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  try {
    const db = new Database(req.file.path);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name: string}[];
    
    const results: any = {};
    for (const table of tables) {
      try {
        results[table.name] = db.prepare(`SELECT * FROM ${table.name}`).all();
      } catch (e) {
        console.warn(`[SQLITE IMPORT] Could not read table ${table.name}:`, e);
      }
    }
    db.close();

    // Mapping table and column names for compatibility
    const normalize = (data: any[]) => {
      return data.map(row => {
        const newRow: any = {};
        for (const key in row) {
          // Map snake_case to camelCase if needed, or specific name overrides
          let newKey = key.toLowerCase();
          if (newKey === 'passwordhash') newKey = 'password_hash';
          if (newKey === 'isblocked') newKey = 'is_blocked';
          if (newKey === 'entrydate') newKey = 'entry_date';
          if (newKey === 'exitdate') newKey = 'exit_date';
          if (newKey === 'memberid') newKey = 'member_id';
          if (newKey === 'startdate') newKey = 'start_date';
          if (newKey === 'enddate') newKey = 'end_date';
          if (newKey === 'importid') newKey = 'import_id';
          if (newKey === 'createdat') newKey = 'created_at';
          if (newKey === 'riftseason') newKey = 'rift_season';
          if (newKey === 'seasonnumber') newKey = 'season_number';
          if (newKey === 'closedat') newKey = 'closed_at';
          if (newKey === 'tournamenttype') newKey = 'tournament_type';
          
          newRow[newKey] = row[key];
        }
        return newRow;
      });
    };

    // Helper to find data by prioritized table name
    const getTableData = (primaryName: string, ...alternatives: string[]) => {
      const names = [primaryName, primaryName.toLowerCase(), primaryName.toUpperCase(), ...alternatives];
      for (const name of names) {
        if (results[name]) return normalize(results[name]);
      }
      return [];
    };

    const finalData = {
      users: getTableData('User', 'users'),
      settings: getTableData('Setting', 'settings'),
      members: getTableData('Member', 'members'),
      member_roles: getTableData('MemberRole', 'member_roles'),
      power_history: getTableData('PowerHistory', 'power_history'),
      guerra_total: getTableData('GuerraTotal', 'guerra_total'),
      torneio_celeste: getTableData('TorneioCeleste', 'torneio_celeste'),
      pico_gloria: getTableData('PicoGloria', 'pico_gloria'),
      fenda_history: getTableData('FendaHistory', 'fenda_history', 'fendaHistory'),
      rift_seasons: getTableData('RiftSeason', 'rift_seasons'),
      absence_justifications: getTableData('AbsenceJustification', 'absence_justifications'),
      imports: getTableData('Import', 'imports'),
      stored_csvs: getTableData('StoredCsv', 'stored_csvs', 'storedCsv'),
      system_roles: getTableData('SystemRole', 'system_roles', 'system_role'),
    };

    // Re-use logic from JSON import by simulating its structure
    // We send finalData as the 'data' to process
    
    // START DB RESET (Copied from /api/admin/db/import)
    await prisma.$transaction([
      prisma.securityLog.deleteMany(),
      prisma.absenceJustification.deleteMany(),
      prisma.fendaHistory.deleteMany(),
      prisma.picoGloria.deleteMany(),
      prisma.torneioCeleste.deleteMany(),
      prisma.guerraTotal.deleteMany(),
      prisma.powerHistory.deleteMany(),
      prisma.memberRole.deleteMany(),
      prisma.member.deleteMany(),
      prisma.storedCsv.deleteMany(),
      prisma.import.deleteMany(),
      prisma.riftSeason.deleteMany(),
      prisma.setting.deleteMany(),
      prisma.systemRole.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    const getData = (key: string) => (finalData as any)[key] || [];

    // Import Role-based data first
    const systemRoles = getData('system_roles');
    if (systemRoles.length > 0) await prisma.systemRole.createMany({ data: systemRoles });

    const users = getData('users');
    if (users.length > 0) await prisma.user.createMany({ data: mapOldUsers(users) });

    const settings = getData('settings');
    if (settings.length > 0) await prisma.setting.createMany({ data: settings });

    const imports = getData('imports');
    if (imports.length > 0) {
      await prisma.import.createMany({ data: imports.map((i: any) => ({ ...i, created_at: i.created_at ? new Date(i.created_at) : new Date() })) });
    }

    const riftSeasons = getData('rift_seasons');
    if (riftSeasons.length > 0) await prisma.riftSeason.createMany({ data: mapOldRiftSeasons(riftSeasons) });
    
    const members = getData('members');
    if (members.length > 0) await prisma.member.createMany({ data: members });
    
    const memberRoles = getData('member_roles');
    if (memberRoles.length > 0) await prisma.memberRole.createMany({ data: mapOldMemberRoles(memberRoles) });

    const powerHistory = getData('power_history');
    if (powerHistory.length > 0) await prisma.powerHistory.createMany({ data: mapOldPowerHistory(powerHistory) });

    const guerraTotal = getData('guerra_total');
    if (guerraTotal.length > 0) await prisma.guerraTotal.createMany({ data: mapOldGuerraTotal(guerraTotal) });

    const torneioCeleste = getData('torneio_celeste');
    if (torneioCeleste.length > 0) await prisma.torneioCeleste.createMany({ data: mapOldTorneioCeleste(torneioCeleste) });

    const picoGloria = getData('pico_gloria');
    if (picoGloria.length > 0) await prisma.picoGloria.createMany({ data: mapOldPicoGloria(picoGloria) });

    const fendaHistory = getData('fenda_history');
    if (fendaHistory.length > 0) await prisma.fendaHistory.createMany({ data: mapOldFendaHistory(fendaHistory) });

    const absenceJustifications = getData('absence_justifications');
    if (absenceJustifications.length > 0) await prisma.absenceJustification.createMany({ data: mapOldAbsenceJustification(absenceJustifications) });

    const storedCSVs = getData('stored_csvs');
    if (storedCSVs.length > 0) {
      await prisma.storedCsv.createMany({ data: storedCSVs.map((c: any) => ({ ...c, created_at: c.created_at ? new Date(c.created_at) : new Date() })) });
    }
    
    await resetSqliteSequences();
    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: 'Dados migrados do SQLite com sucesso' });

  } catch (e: any) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[SQLITE IMPORT ERROR]', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Folder Scanning API ---

async function scanAndRegisterCsvs() {
  try {
    const filesInUploads = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR).filter(f => f.toLowerCase().endsWith('.csv')) : [];
    const filesInCsv = fs.existsSync(CSV_STORAGE_DIR) ? fs.readdirSync(CSV_STORAGE_DIR).filter(f => f.toLowerCase().endsWith('.csv')) : [];
    
    const allCsvs = [
      ...filesInUploads.map(f => ({ name: f, path: path.join(UPLOADS_DIR, f), isRoot: true })),
      ...filesInCsv.map(f => ({ name: f, path: path.join(CSV_STORAGE_DIR, f), isRoot: false }))
    ];
    
    for (const file of allCsvs) {
      const exists = await prisma.storedCsv.findFirst({ 
        where: { 
          OR: [
            { filename: file.name },
            { original_name: file.name }
          ]
        } 
      });

      if (!exists) {
        let type = 'power';
        const name = file.name.toLowerCase();
        if (name.includes('celeste')) type = 'torneio_celeste';
        else if (name.includes('gloria') || name.includes('picode')) type = 'pico_gloria';
        else if (name.includes('guerra')) type = 'guerra_total';
        else if (name.includes('fenda') || name.includes('cristais')) type = 'fenda';
        else if (name.includes('membros') || name.includes('members')) type = 'members';
        
        let finalFilename = file.name;
        if (file.isRoot) {
          finalFilename = `${Date.now()}-${file.name}`;
          fs.copyFileSync(file.path, path.join(CSV_STORAGE_DIR, finalFilename));
          fs.unlinkSync(file.path);
        }
        
        await prisma.storedCsv.create({
          data: { filename: finalFilename, original_name: file.name, type }
        });
      }
    }
  } catch (e) {
    console.error('[AUTO-SCAN] Error:', e);
  }
}

app.post('/api/admin/scan-csv-folder', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  try {
    const before = await prisma.storedCsv.count();
    await scanAndRegisterCsvs();
    const after = await prisma.storedCsv.count();
    res.json({ success: true, added: after - before });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function startServer() {
  // Ensure DB is healthy before starting
  await checkAndFixDatabase();
  
  // Auto-scan CSVs in folders
  await scanAndRegisterCsvs();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Log non-existent static files (potential bot scans)
    app.use('/assets', (req, res, next) => {
      logSecurityEvent(req, 'BOT_FILE_SCAN', `Missing asset: ${req.url}`);
      res.status(404).json({ error: 'Not found' });
    });

    app.get('*', (req, res) => {
      // If it looks like an API attempt or a direct file access that reached here, log it
      if (req.url.startsWith('/api') || req.url.includes('.')) {
        logSecurityEvent(req, 'NOT_FOUND_OR_BOT', `Path: ${req.url}`);
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Final fallback for truly non-existent paths (after SPA logic)
  app.use((req, res) => {
    logSecurityEvent(req, '404_NOT_FOUND', `Invalid access: ${req.url}`);
    res.status(404).json({ error: 'Página não encontrada' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
