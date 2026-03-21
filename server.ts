import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

app.use(express.json());

// Setup Database
const db = new Database('guild.db');

const checkAndFixDatabase = () => {
  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_blocked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nick TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'ativo',
      entry_date TEXT NOT NULL,
      exit_date TEXT
    );

    CREATE TABLE IF NOT EXISTS member_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS power_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      power BIGINT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS guerra_total (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      power BIGINT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS torneio_celeste (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      guild TEXT NOT NULL,
      score INTEGER NOT NULL,
      field TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS pico_gloria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      score INTEGER NOT NULL,
      team TEXT DEFAULT 'Livre',
      date TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('fenda_season', '1');

    CREATE TABLE IF NOT EXISTS fenda_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      crystals BIGINT NOT NULL,
      date TEXT NOT NULL,
      season INTEGER NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS rift_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER NOT NULL UNIQUE,
      closed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Ensure specific columns exist
  const checkColumn = (table: string, column: string, typeDef: string) => {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      if (!columns.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
        console.log(`[DB Fix] Added column ${column} to ${table}`);
      }
    } catch (e) {
      console.error(`[DB Fix] Error checking/adding column ${column} to ${table}:`, e);
    }
  };

  const tablesToAlter = ['members', 'power_history', 'guerra_total', 'torneio_celeste', 'pico_gloria', 'fenda_history'];
  for (const table of tablesToAlter) {
    checkColumn(table, 'import_id', 'INTEGER REFERENCES imports(id)');
  }

  checkColumn('pico_gloria', 'team', "TEXT DEFAULT 'Livre'");

  // Create default admin if not exists
  const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('[DB Fix] Created default admin user');
  }
};

// Run on startup
checkAndFixDatabase();

// Multer for CSV uploads
const upload = multer({ dest: 'uploads/' });

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API Routes

// Auth
app.post('/api/auth/login', (req, res) => {
  // Run DB fix on login as requested
  checkAndFixDatabase();
  
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  
  if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });
  if (user.is_blocked) return res.status(403).json({ error: 'Usuário bloqueado' });
  
  if (bcrypt.compareSync(password, user.password_hash)) {
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(400).json({ error: 'Senha incorreta' });
  }
});

app.post('/api/auth/register', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admins podem registrar usuários' });
  const { username, password } = req.body;
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Usuário já existe' });
  }
});

app.get('/api/users', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const users = db.prepare('SELECT id, username, role, is_blocked FROM users').all();
  res.json(users);
});

app.post('/api/users/:id/block', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { blocked } = req.body;
  db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.post('/api/users/:id/role', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') return res.status(400).json({ error: 'Papel inválido' });
  
  if (role === 'user') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any;
    const targetUser = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id) as any;
    if (targetUser && targetUser.role === 'admin' && adminCount.count <= 1) {
      return res.status(400).json({ error: 'Não é possível remover o último administrador' });
    }
  }
  
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

app.post('/api/users/:id/reset-password', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { newPassword } = req.body;
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  try {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any;
    const targetUser = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id) as any;
    if (targetUser && targetUser.role === 'admin' && adminCount.count <= 1) {
      return res.status(400).json({ error: 'Não é possível excluir o último administrador' });
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Members
app.get('/api/members', authenticateToken, (req, res) => {
  const members = db.prepare(`
    SELECT m.*, 
           COALESCE((SELECT role FROM member_roles WHERE member_id = m.id AND end_date IS NULL ORDER BY start_date DESC LIMIT 1), 'Membro') as role
    FROM members m
  `).all();
  res.json(members);
});

app.post('/api/members', authenticateToken, (req, res) => {
  const { nick, entry_date } = req.body;
  try {
    const result = db.prepare('INSERT INTO members (nick, entry_date) VALUES (?, ?)').run(nick, entry_date);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Membro já existe' });
  }
});

app.put('/api/members/:id', authenticateToken, (req, res) => {
  const { status, exit_date } = req.body;
  db.prepare('UPDATE members SET status = ?, exit_date = ? WHERE id = ?').run(status, exit_date, req.params.id);
  res.json({ success: true });
});

app.get('/api/members/:id/roles', authenticateToken, (req, res) => {
  const roles = db.prepare('SELECT * FROM member_roles WHERE member_id = ? ORDER BY start_date DESC').all(req.params.id);
  res.json(roles);
});

app.post('/api/members/:id/roles', authenticateToken, (req, res) => {
  const { role, start_date } = req.body;
  
  // Close previous role if exists
  db.prepare('UPDATE member_roles SET end_date = ? WHERE member_id = ? AND end_date IS NULL').run(start_date, req.params.id);
  
  db.prepare('INSERT INTO member_roles (member_id, role, start_date) VALUES (?, ?, ?)').run(req.params.id, role, start_date);
  res.json({ success: true });
});

app.delete('/api/members/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const id = req.params.id;
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM power_history WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM guerra_total WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM torneio_celeste WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM pico_gloria WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM fenda_history WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM member_roles WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM members WHERE id = ?').run(id);
    })();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Power History
app.get('/api/power/compare', authenticateToken, (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Datas start e end são obrigatórias' });

  const data = db.prepare(`
    SELECT 
      m.nick,
      m.status,
      COALESCE((SELECT role FROM member_roles WHERE member_id = m.id AND end_date IS NULL ORDER BY start_date DESC LIMIT 1), 'Membro') as role,
      COALESCE(MAX(CASE WHEN p.date = ? THEN p.power END), 0) as start_power,
      COALESCE(MAX(CASE WHEN p.date = ? THEN p.power END), 0) as end_power
    FROM members m
    LEFT JOIN power_history p ON m.id = p.member_id AND p.date IN (?, ?)
    GROUP BY m.id
    HAVING start_power > 0 OR end_power > 0
  `).all(start, end, start, end);
  
  res.json(data);
});

app.get('/api/power', authenticateToken, (req, res) => {
  const history = db.prepare(`
    SELECT p.*, m.nick, m.status,
           COALESCE((SELECT role FROM member_roles WHERE member_id = m.id AND end_date IS NULL ORDER BY start_date DESC LIMIT 1), 'Membro') as role
    FROM power_history p 
    JOIN members m ON p.member_id = m.id 
    ORDER BY p.date DESC
  `).all();
  res.json(history);
});

app.delete('/api/power/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    db.prepare('DELETE FROM power_history WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/power/date/:date', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    db.prepare('DELETE FROM power_history WHERE date = ?').run(req.params.date);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Tournaments
app.get('/api/tournaments/:type/compare', authenticateToken, (req, res) => {
  const { type } = req.params;
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Datas start e end são obrigatórias' });

  const validTypes = ['guerra_total', 'torneio_celeste', 'pico_gloria'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

  const valueColumn = type === 'guerra_total' ? 'power' : 'score';

  const data = db.prepare(`
    SELECT 
      m.nick,
      m.status,
      COALESCE(MAX(CASE WHEN t.date = ? THEN t.${valueColumn} END), 0) as start_value,
      COALESCE(MAX(CASE WHEN t.date = ? THEN t.${valueColumn} END), 0) as end_value
    FROM members m
    LEFT JOIN ${type} t ON m.id = t.member_id AND t.date IN (?, ?)
    GROUP BY m.id
    HAVING start_value > 0 OR end_value > 0
  `).all(start, end, start, end);
  
  res.json(data);
});

app.get('/api/tournaments/guerra_total', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT t.*, m.nick, m.status FROM guerra_total t JOIN members m ON t.member_id = m.id ORDER BY t.date DESC').all();
  res.json(data);
});

app.get('/api/tournaments/torneio_celeste', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT t.*, m.nick, m.status FROM torneio_celeste t JOIN members m ON t.member_id = m.id ORDER BY t.date DESC').all();
  res.json(data);
});

app.get('/api/tournaments/pico_gloria', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT t.*, m.nick, m.status FROM pico_gloria t JOIN members m ON t.member_id = m.id ORDER BY t.date DESC').all();
  res.json(data);
});

app.delete('/api/tournaments/:type/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const type = req.params.type;
  if (!['guerra_total', 'torneio_celeste', 'pico_gloria'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    db.prepare(`DELETE FROM ${type} WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tournaments/:type/date/:date', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const type = req.params.type;
  if (!['guerra_total', 'torneio_celeste', 'pico_gloria'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    db.prepare(`DELETE FROM ${type} WHERE date = ?`).run(req.params.date);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Fenda
app.get('/api/fenda/compare', authenticateToken, (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Datas start e end são obrigatórias' });

  const data = db.prepare(`
    SELECT 
      m.nick,
      m.status,
      COALESCE(MAX(CASE WHEN f.date = ? THEN f.crystals END), 0) as start_value,
      COALESCE(MAX(CASE WHEN f.date = ? THEN f.crystals END), 0) as end_value
    FROM members m
    LEFT JOIN fenda_history f ON m.id = f.member_id AND f.date IN (?, ?)
    GROUP BY m.id
    HAVING start_value > 0 OR end_value > 0
  `).all(start, end, start, end);
  
  res.json(data);
});

app.get('/api/fenda', authenticateToken, (req, res) => {
  const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
  const season = parseInt(seasonRow?.value || '1', 10);
  
  const data = db.prepare(`
    SELECT f.id, m.nick, m.status, f.crystals, f.date 
    FROM fenda_history f
    JOIN members m ON f.member_id = m.id
    WHERE f.season = ?
    ORDER BY f.crystals DESC
  `).all(season);
  
  res.json({ season, data });
});

app.get('/api/fenda/seasons', authenticateToken, (req, res) => {
  const seasons = db.prepare('SELECT * FROM rift_seasons ORDER BY season_number DESC').all();
  res.json(seasons);
});

app.post('/api/fenda/close', authenticateToken, (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Data de fechamento é obrigatória' });
  
  db.transaction(() => {
    const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
    const currentSeason = parseInt(seasonRow?.value || '1', 10);
    
    db.prepare('INSERT INTO rift_seasons (season_number, closed_at) VALUES (?, ?)').run(currentSeason, date);
    
    const newSeason = currentSeason + 1;
    db.prepare("UPDATE settings SET value = ? WHERE key = 'fenda_season'").run(newSeason.toString());
  })();
  res.json({ success: true });
});

app.post('/api/fenda/reopen', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const { season_number } = req.body;
  
  db.transaction(() => {
    if (season_number) {
       db.prepare('DELETE FROM rift_seasons WHERE season_number = ?').run(season_number);
       db.prepare("UPDATE settings SET value = ? WHERE key = 'fenda_season'").run(season_number.toString());
    } else {
      const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
      const currentSeason = parseInt(seasonRow?.value || '1', 10);
      if (currentSeason > 1) {
        const prevSeason = currentSeason - 1;
        db.prepare('DELETE FROM rift_seasons WHERE season_number = ?').run(prevSeason);
        db.prepare("UPDATE settings SET value = ? WHERE key = 'fenda_season'").run(prevSeason.toString());
      }
    }
  })();
  res.json({ success: true });
});

app.delete('/api/fenda/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    db.prepare('DELETE FROM fenda_history WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/fenda/date/:date', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    db.prepare('DELETE FROM fenda_history WHERE date = ?').run(req.params.date);
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

app.post('/api/upload/:type/preview', authenticateToken, upload.single('file'), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  
  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, trim: true, bom: true, delimiter: [',', ';'] }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.unlinkSync(req.file!.path);
      
      const unknownNicks = new Set<string>();
      const getMember = db.prepare('SELECT id FROM members WHERE nick = ?');
      
      for (const row of results) {
        const nick = row.Nick || row.nick || row.NICK;
        if (nick && !getMember.get(nick)) {
          unknownNicks.add(nick);
        }
      }
      
      res.json({ 
        results, 
        unknownNicks: Array.from(unknownNicks)
      });
    });
});

app.post('/api/upload/:type', authenticateToken, (req: any, res) => {
  const type = req.params.type;
  const { results, mappings } = req.body;
  
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }
  
  try {
    const insertMember = db.prepare('INSERT OR IGNORE INTO members (nick, entry_date, import_id) VALUES (?, ?, ?)');
    const getMember = db.prepare('SELECT id FROM members WHERE nick = ?');
    
    let importedCount = 0;
    db.transaction(() => {
      const importDate = new Date().toISOString().split('T')[0];
      const importResult = db.prepare('INSERT INTO imports (user_id, type, date) VALUES (?, ?, ?)').run(req.user.id, type, importDate);
      const importId = importResult.lastInsertRowid;

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
            insertMember.run(nick, entryDate, importId);
            const member = getMember.get(nick) as any;
            memberId = member?.id;
          }
        } else {
          // Default behavior: ensure member exists
          const rawDate = row.Date || row.date || row.Data || row.data || row.DATA;
          const entryDate = parseDateStr(rawDate, importDate);
          insertMember.run(nick, entryDate, importId);
          const member = getMember.get(nick) as any;
          memberId = member?.id;
        }

        if (!memberId) continue;
        
        const rawDate = row.Date || row.date || row.Data || row.data || row.DATA;
        const entryDate = parseDateStr(rawDate, importDate);

        if (type === 'members') {
          // Just members
        } else if (type === 'power') {
          db.prepare('INSERT INTO power_history (member_id, power, date, import_id) VALUES (?, ?, ?, ?)').run(
            memberId, row.Power || row.power || row.Poder || row.poder || row.PODER, entryDate, importId
          );
        } else if (type === 'guerra_total') {
          db.prepare('INSERT INTO guerra_total (member_id, power, date, import_id) VALUES (?, ?, ?, ?)').run(
            memberId, row.Power || row.power || row.Poder || row.poder || row.PODER, entryDate, importId
          );
        } else if (type === 'torneio_celeste') {
          db.prepare('INSERT INTO torneio_celeste (member_id, guild, score, field, date, import_id) VALUES (?, ?, ?, ?, ?, ?)').run(
            memberId, row.Guild || row.guild || row.GUILD, row.Score || row.score || row.Pontuacao || row.pontuacao || row.PONTUACAO, row.Field || row.field || row.Campo || row.campo || row.CAMPO, entryDate, importId
          );
        } else if (type === 'pico_gloria') {
          const team = row.Team || row.team || row.Time || row.time || row.TIME || 'Livre';
          db.prepare('INSERT INTO pico_gloria (member_id, round, score, team, date, import_id) VALUES (?, ?, ?, ?, ?, ?)').run(
            memberId, row.Round || row.round || row.Rodada || row.rodada || row.RODADA, row.Score || row.score || row.Pontuacao || row.pontuacao || row.PONTUACAO, team, entryDate, importId
          );
        } else if (type === 'fenda') {
          const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
          const season = parseInt(seasonRow?.value || '1', 10);
          const crystals = row.Crystals || row.crystals || row.Cristais || row.cristais || row.CRISTAIS;
          if (crystals) {
            db.prepare('INSERT INTO fenda_history (member_id, crystals, date, season, import_id) VALUES (?, ?, ?, ?, ?)').run(
              memberId, crystals, entryDate, season, importId
            );
          }
        }
        importedCount++;
      }
    })();
    
    res.json({ success: true, count: importedCount });
  } catch (e: any) {
    res.status(500).json({ error: 'Erro ao processar importação: ' + e.message });
  }
});

// Imports History
app.get('/api/imports', authenticateToken, (req, res) => {
  const imports = db.prepare(`
    SELECT i.*, u.username 
    FROM imports i 
    JOIN users u ON i.user_id = u.id 
    ORDER BY i.created_at DESC
  `).all();
  res.json(imports);
});

app.delete('/api/imports/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const id = req.params.id;
  
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM power_history WHERE import_id = ?').run(id);
      db.prepare('DELETE FROM guerra_total WHERE import_id = ?').run(id);
      db.prepare('DELETE FROM torneio_celeste WHERE import_id = ?').run(id);
      db.prepare('DELETE FROM pico_gloria WHERE import_id = ?').run(id);
      db.prepare('DELETE FROM fenda_history WHERE import_id = ?').run(id);
      db.prepare('DELETE FROM members WHERE import_id = ?').run(id);
      db.prepare('DELETE FROM imports WHERE id = ?').run(id);
    })();
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Absences (Faltas)
app.get('/api/absences', authenticateToken, (req, res) => {
  const allMembers = db.prepare("SELECT id, nick, status FROM members").all() as any[];
  
  // Get all unique dates from tournaments
  const datesGT = db.prepare('SELECT DISTINCT date FROM guerra_total').all() as any[];
  const datesTC = db.prepare('SELECT DISTINCT date FROM torneio_celeste').all() as any[];
  const datesPG = db.prepare('SELECT DISTINCT date FROM pico_gloria').all() as any[];
  
  const absences = allMembers.map(m => {
    let missed = 0;
    
    for (const d of datesGT) {
      const participated = db.prepare('SELECT 1 FROM guerra_total WHERE member_id = ? AND date = ?').get(m.id, d.date);
      if (!participated) missed++;
    }
    for (const d of datesTC) {
      const participated = db.prepare('SELECT 1 FROM torneio_celeste WHERE member_id = ? AND date = ?').get(m.id, d.date);
      if (!participated) missed++;
    }
    for (const d of datesPG) {
      const participated = db.prepare('SELECT 1 FROM pico_gloria WHERE member_id = ? AND date = ?').get(m.id, d.date);
      if (!participated) missed++;
    }
    
    return { nick: m.nick, status: m.status, absences: missed };
  });
  
  res.json(absences.filter(a => a.absences > 0).sort((a, b) => b.absences - a.absences));
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
