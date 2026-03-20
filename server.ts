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
`);

// Create default admin if not exists
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
}

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

// Members
app.get('/api/members', authenticateToken, (req, res) => {
  const members = db.prepare('SELECT * FROM members').all();
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

// Power History
app.get('/api/power', authenticateToken, (req, res) => {
  const history = db.prepare(`
    SELECT p.*, m.nick 
    FROM power_history p 
    JOIN members m ON p.member_id = m.id 
    ORDER BY p.date DESC
  `).all();
  res.json(history);
});

// Tournaments
app.get('/api/tournaments/guerra_total', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT t.*, m.nick FROM guerra_total t JOIN members m ON t.member_id = m.id ORDER BY t.date DESC').all();
  res.json(data);
});

app.get('/api/tournaments/torneio_celeste', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT t.*, m.nick FROM torneio_celeste t JOIN members m ON t.member_id = m.id ORDER BY t.date DESC').all();
  res.json(data);
});

app.get('/api/tournaments/pico_gloria', authenticateToken, (req, res) => {
  const data = db.prepare('SELECT t.*, m.nick FROM pico_gloria t JOIN members m ON t.member_id = m.id ORDER BY t.date DESC').all();
  res.json(data);
});

// Fenda
app.get('/api/fenda', authenticateToken, (req, res) => {
  const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
  const season = parseInt(seasonRow?.value || '1', 10);
  
  const data = db.prepare(`
    SELECT f.id, m.nick, f.crystals, f.date 
    FROM fenda_history f
    JOIN members m ON f.member_id = m.id
    WHERE f.season = ?
    ORDER BY f.crystals DESC
  `).all(season);
  
  res.json({ season, data });
});

app.post('/api/fenda/close', authenticateToken, (req, res) => {
  db.transaction(() => {
    const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
    const newSeason = parseInt(seasonRow?.value || '1', 10) + 1;
    db.prepare("UPDATE settings SET value = ? WHERE key = 'fenda_season'").run(newSeason.toString());
  })();
  res.json({ success: true });
});

// CSV Uploads
app.post('/api/upload/:type', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  
  const type = req.params.type;
  const results: any[] = [];
  
  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, trim: true, bom: true, delimiter: [',', ';'] }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.unlinkSync(req.file!.path); // Clean up
      
      try {
        const insertMember = db.prepare('INSERT OR IGNORE INTO members (nick, entry_date) VALUES (?, ?)');
        const getMember = db.prepare('SELECT id FROM members WHERE nick = ?');
        
        if (results.length === 0) {
          return res.status(400).json({ error: 'O arquivo CSV está vazio ou não pôde ser lido corretamente. Verifique as colunas (Nick, Poder, Data, etc).' });
        }
        
        let importedCount = 0;
        db.transaction(() => {
          for (const row of results) {
            // Ensure member exists
            const nick = row.Nick || row.nick || row.NICK;
            if (!nick) continue;
            
            const entryDate = row.Date || row.date || row.Data || row.data || row.DATA || new Date().toISOString().split('T')[0];
            insertMember.run(nick, entryDate);
            const member = getMember.get(nick) as any;
            if (!member) continue;
            
            if (type === 'members') {
              // Just importing members, nothing else to insert
            } else if (type === 'power') {
              db.prepare('INSERT INTO power_history (member_id, power, date) VALUES (?, ?, ?)').run(
                member.id, row.Power || row.power || row.Poder || row.poder || row.PODER, row.Date || row.date || row.Data || row.data || row.DATA
              );
            } else if (type === 'guerra_total') {
              db.prepare('INSERT INTO guerra_total (member_id, power, date) VALUES (?, ?, ?)').run(
                member.id, row.Power || row.power || row.Poder || row.poder || row.PODER, row.Date || row.date || row.Data || row.data || row.DATA
              );
            } else if (type === 'torneio_celeste') {
              db.prepare('INSERT INTO torneio_celeste (member_id, guild, score, field, date) VALUES (?, ?, ?, ?, ?)').run(
                member.id, row.Guild || row.guild || row.GUILD, row.Score || row.score || row.Pontuacao || row.pontuacao || row.PONTUACAO, row.Field || row.field || row.Campo || row.campo || row.CAMPO, row.Date || row.date || row.Data || row.data || row.DATA
              );
            } else if (type === 'pico_gloria') {
              db.prepare('INSERT INTO pico_gloria (member_id, round, score, date) VALUES (?, ?, ?, ?)').run(
                member.id, row.Round || row.round || row.Rodada || row.rodada || row.RODADA, row.Score || row.score || row.Pontuacao || row.pontuacao || row.PONTUACAO, row.Date || row.date || row.Data || row.data || row.DATA
              );
            } else if (type === 'fenda') {
              const seasonRow = db.prepare("SELECT value FROM settings WHERE key = 'fenda_season'").get() as any;
              const season = parseInt(seasonRow?.value || '1', 10);
              const crystals = row.Crystals || row.crystals || row.Cristais || row.cristais || row.CRISTAIS;
              if (crystals) {
                db.prepare('INSERT INTO fenda_history (member_id, crystals, date, season) VALUES (?, ?, ?, ?)').run(
                  member.id, crystals, row.Date || row.date || row.Data || row.data || row.DATA || new Date().toISOString().split('T')[0], season
                );
              }
            }
            importedCount++;
          }
        })();
        
        if (importedCount === 0) {
          return res.status(400).json({ error: 'Nenhuma linha válida encontrada. Certifique-se de que a coluna "Nick" existe.' });
        }
        res.json({ success: true, count: importedCount });
      } catch (e: any) {
        res.status(500).json({ error: 'Erro ao processar CSV: ' + e.message });
      }
    });
});

// Absences (Faltas)
app.get('/api/absences', authenticateToken, (req, res) => {
  // Find active members who don't have records in tournaments for a given date range
  // For simplicity, let's just count total tournaments they missed
  
  const activeMembers = db.prepare("SELECT id, nick FROM members WHERE status = 'ativo'").all() as any[];
  
  // Get all unique dates from tournaments
  const datesGT = db.prepare('SELECT DISTINCT date FROM guerra_total').all() as any[];
  const datesTC = db.prepare('SELECT DISTINCT date FROM torneio_celeste').all() as any[];
  const datesPG = db.prepare('SELECT DISTINCT date FROM pico_gloria').all() as any[];
  
  const absences = activeMembers.map(m => {
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
    
    return { nick: m.nick, absences: missed };
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
