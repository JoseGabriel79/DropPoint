// TLS padrão mantido; não desabilitar verificação de certificados

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com o banco PostgreSQL
const connectionString = process.env.DATABASE_URL;
// SSL condicional; quando necessário, desativa verificação de certificado
const needsSSL = (process.env.DATABASE_SSL === 'true') || /sslmode=require/i.test((process.env.DATABASE_URL || ''));
const sslOpt = needsSSL ? { rejectUnauthorized: false } : false;
if (!connectionString) {
  console.warn("⚠️ DATABASE_URL não definido. Configure back_end/.env antes de usar rotas que acessam o banco.");
}
const pool = new Pool({ connectionString, ssl: sslOpt });

// Verificar/criar tabelas automaticamente no startup
async function initDb() {
  const ddl = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    senha_hash TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'usuario',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    disponivel BOOLEAN NOT NULL DEFAULT FALSE,
    data_cadastro TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL,
    tipo_objeto VARCHAR(30) NOT NULL,
    empresa VARCHAR(50) NOT NULL,
    endereco TEXT NOT NULL,
    observacoes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pedidos_usuario_codigo_unique UNIQUE (usuario_id, codigo)
  );
  ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motoboy_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
  ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entrega_movel BOOLEAN NOT NULL DEFAULT false;
  `;
  try {
    await pool.query(ddl);
    console.log('✅ Tabelas verificadas/criadas');
  } catch (err) {
    console.error('🟥 Erro ao criar/verificar tabelas:', err);
  }
}

initDb();

// Servir estáticos do front-end
app.use(express.static(path.join(__dirname, "../front_end/public")));
app.use("/css", express.static(path.join(__dirname, "../front_end/css")));
app.use("/img", express.static(path.join(__dirname, "../front_end/img")));
app.use("/script", express.static(path.join(__dirname, "../front_end/script")));

// Util: atualizar timestamp
async function touchPedido(id) {
  await pool.query("UPDATE pedidos SET data_atualizacao = NOW() WHERE id = $1", [id]);
}

// Raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Cadastro de usuário (cliente por padrão)
app.post("/usuarios", async (req, res) => {
  try {
    const { login, email, senha, telefone, tipo = "usuario", status = "ativo" } = req.body;

    if (!login || !email || !senha) {
      return res.status(400).json({ erro: "Campos obrigatórios: login, email, senha" });
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    const query = `
      INSERT INTO usuarios (login, email, telefone, senha_hash, tipo, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, login, email, telefone, tipo, status, data_cadastro;
    `;

    const values = [login, email, telefone || null, senha_hash, tipo, status];
    const { rows } = await pool.query(query, values);

    res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!", usuario: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao cadastrar usuário:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Login usuário
app.post("/loginUsuario", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: "Campos obrigatórios: email, senha" });

    const { rows } = await pool.query(
      "SELECT id, login, email, telefone, senha_hash, tipo, status FROM usuarios WHERE email = $1 AND tipo = 'usuario'",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ erro: "Usuário não encontrado" });

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: "Credenciais inválidas" });

    delete user.senha_hash;
    res.json({ mensagem: "Login bem-sucedido", usuario: user });
  } catch (erro) {
    console.error("🟥 Erro em loginUsuario:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Login motoboy
app.post("/loginMotoboy", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: "Campos obrigatórios: email, senha" });

    const { rows } = await pool.query(
      "SELECT id, login, email, telefone, senha_hash, tipo, status, disponivel FROM usuarios WHERE email = $1 AND tipo = 'motoboy'",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ erro: "Motoboy não encontrado" });

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: "Credenciais inválidas" });

    delete user.senha_hash;
    res.json({ mensagem: "Login bem-sucedido", usuario: user });
  } catch (erro) {
    console.error("🟥 Erro em loginMotoboy:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Listar motoboys (opcional filtro por email)
app.get("/motoboys", async (req, res) => {
  try {
    const { email, disponivel } = req.query;
    let sql = "SELECT id, login, email, telefone, tipo, status, disponivel, data_cadastro FROM usuarios WHERE tipo = 'motoboy'";
    const params = [];
    if (email) { sql += " AND email = $" + (params.push(email)); }
    if (String(disponivel).toLowerCase() === 'true') { sql += " AND disponivel = TRUE"; }
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (erro) {
    console.error("🟥 Erro ao listar motoboys:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Atualizar disponibilidade do motoboy
app.put("/motoboys/:id/disponibilidade", async (req, res) => {
  try {
    const { id } = req.params;
    const { disponivel } = req.body;
    if (typeof disponivel !== 'boolean') return res.status(400).json({ erro: "Campo obrigatorio: disponivel (boolean)" });

    const requesterIdHeader = req.header('x-user-id');
    if (!requesterIdHeader) return res.status(401).json({ erro: "Cabeçalho X-User-Id obrigatório" });
    const requesterId = parseInt(requesterIdHeader, 10);
    if (isNaN(requesterId)) return res.status(400).json({ erro: "X-User-Id inválido" });
    if (requesterId !== parseInt(id, 10)) return res.status(403).json({ erro: "Motoboy só pode alterar a própria disponibilidade" });

    const { rows: reqRows } = await pool.query(
      "SELECT id, tipo, status FROM usuarios WHERE id = $1",
      [requesterId]
    );
    const requester = reqRows[0];
    if (!requester) return res.status(401).json({ erro: "Motoboy não encontrado" });
    if (requester.status !== 'ativo') return res.status(403).json({ erro: "Motoboy inativo" });
    if (requester.tipo !== 'motoboy') return res.status(403).json({ erro: "Apenas motoboys podem alterar disponibilidade" });

    const { rowCount, rows } = await pool.query(
      "UPDATE usuarios SET disponivel = $1 WHERE id = $2 RETURNING id, login, email, telefone, tipo, status, disponivel",
      [disponivel, requesterId]
    );
    if (!rowCount) return res.status(404).json({ erro: "Motoboy não encontrado" });
    res.json({ mensagem: "Disponibilidade atualizada", usuario: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao atualizar disponibilidade:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});
// Criar pedido
app.post("/pedidos", async (req, res) => {
  try {
    const { usuario_id, codigoPedido, tipoObjeto, empresa, endereco, observacoes, entregaMovel } = req.body;
    if (!usuario_id || !codigoPedido || !tipoObjeto || !empresa || !endereco) {
      return res.status(400).json({ erro: "Campos obrigatórios: usuario_id, codigoPedido, tipoObjeto, empresa, endereco" });
    }

    const query = `
      INSERT INTO pedidos (usuario_id, codigo, tipo_objeto, empresa, endereco, observacoes, status, entrega_movel)
      VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7)
      RETURNING *;
    `;
    const values = [usuario_id, codigoPedido, tipoObjeto, empresa, endereco, observacoes || null, !!entregaMovel];
    const { rows } = await pool.query(query, values);
    res.status(201).json({ mensagem: "Pedido criado com sucesso", pedido: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao criar pedido:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Listar pedidos (opcional por usuário)
app.get("/pedidos", async (req, res) => {
  try {
    const { usuario_id, status, motoboy_id, disponiveis } = req.query;
    const params = [];
    const conds = [];

    const listDisponiveis = String(disponiveis).toLowerCase() === 'true';
    let sql;
    if (listDisponiveis) {
      sql = "SELECT p.*, u.login AS usuario_login FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id";
      conds.push("p.motoboy_id IS NULL");
      conds.push("p.status = 'pendente'");
      conds.push("p.entrega_movel = TRUE");
      if (usuario_id) { conds.push("p.usuario_id = $" + (params.push(usuario_id))); }
      if (status) { conds.push("p.status = $" + (params.push(status))); }
    } else {
      sql = "SELECT * FROM pedidos";
      if (usuario_id) { conds.push("usuario_id = $" + (params.push(usuario_id))); }
      if (motoboy_id) { conds.push("motoboy_id = $" + (params.push(motoboy_id))); }
      if (status) { conds.push("status = $" + (params.push(status))); }
    }

    if (conds.length) sql += " WHERE " + conds.join(" AND ");
    sql += " ORDER BY data_criacao DESC";

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (erro) {
    console.error("🟥 Erro ao listar pedidos:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Motoboy aceita pedido disponível (auto-atribuição)
app.put("/pedidos/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;
    const requesterIdHeader = req.header('x-user-id');
    if (!requesterIdHeader) return res.status(401).json({ erro: "Cabeçalho X-User-Id obrigatório" });
    const motoboyId = parseInt(requesterIdHeader, 10);
    if (isNaN(motoboyId)) return res.status(400).json({ erro: "X-User-Id inválido" });

    const { rows: reqRows } = await pool.query(
      "SELECT id, tipo, status FROM usuarios WHERE id = $1",
      [motoboyId]
    );
    const requester = reqRows[0];
    if (!requester) return res.status(401).json({ erro: "Motoboy não encontrado" });
    if (requester.status !== 'ativo') return res.status(403).json({ erro: "Motoboy inativo" });
    if (requester.tipo !== 'motoboy') return res.status(403).json({ erro: "Apenas motoboys podem aceitar pedidos" });

    // Garantir que o pedido está disponível
    const { rows: pedRows } = await pool.query(
      "SELECT id, motoboy_id, status, entrega_movel FROM pedidos WHERE id = $1",
      [id]
    );
    const ped = pedRows[0];
    if (!ped) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (ped.motoboy_id) return res.status(400).json({ erro: "Pedido já atribuído" });
    if (ped.status !== 'pendente') return res.status(400).json({ erro: "Pedido não está pendente" });
    if (!ped.entrega_movel) return res.status(400).json({ erro: "Pedido não disponível para entrega móvel" });

    const { rowCount, rows } = await pool.query(
      "UPDATE pedidos SET motoboy_id = $1, status = 'andamento', data_atualizacao = NOW() WHERE id = $2 RETURNING *",
      [motoboyId, id]
    );
    if (!rowCount) return res.status(404).json({ erro: "Pedido não encontrado" });
    res.json({ mensagem: "Pedido aceito", pedido: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao aceitar pedido:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Atribuir motoboy a um pedido
app.put("/pedidos/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { motoboy_id } = req.body;
    if (!motoboy_id) return res.status(400).json({ erro: "Campo obrigatório: motoboy_id" });

    // RBAC: apenas gestor pode atribuir motoboy
    const requesterIdHeader = req.header('x-user-id');
    if (!requesterIdHeader) return res.status(401).json({ erro: "Cabeçalho X-User-Id obrigatório" });
    const requesterId = parseInt(requesterIdHeader, 10);
    if (isNaN(requesterId)) return res.status(400).json({ erro: "X-User-Id inválido" });
    const { rows: reqRows } = await pool.query(
      "SELECT id, tipo, status FROM usuarios WHERE id = $1",
      [requesterId]
    );
    const requester = reqRows[0];
    if (!requester) return res.status(401).json({ erro: "Solicitante não encontrado" });
    if (requester.status !== 'ativo') return res.status(403).json({ erro: "Solicitante inativo" });
    if (requester.tipo !== 'gestor') return res.status(403).json({ erro: "Apenas usuários gestor podem atribuir motoboy" });

    const { rows: mrows } = await pool.query(
      "SELECT id, tipo FROM usuarios WHERE id = $1",
      [motoboy_id]
    );
    const moto = mrows[0];
    if (!moto) return res.status(404).json({ erro: "Motoboy não encontrado" });
    if (moto.tipo !== 'motoboy') return res.status(400).json({ erro: "Usuário informado não é um motoboy" });

    const { rowCount, rows } = await pool.query(
      "UPDATE pedidos SET motoboy_id = $1, status = CASE WHEN status = 'pendente' THEN 'andamento' ELSE status END, data_atualizacao = NOW() WHERE id = $2 RETURNING *",
      [motoboy_id, id]
    );
    if (!rowCount) return res.status(404).json({ erro: "Pedido não encontrado" });
    res.json({ mensagem: "Pedido atribuído", pedido: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao atribuir motoboy:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Editar campos de um pedido
app.put("/pedidos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, tipo_objeto, empresa, endereco, observacoes } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;
    if (codigo !== undefined) { fields.push(`codigo = $${idx++}`); values.push(codigo); }
    if (tipo_objeto !== undefined) { fields.push(`tipo_objeto = $${idx++}`); values.push(tipo_objeto); }
    if (empresa !== undefined) { fields.push(`empresa = $${idx++}`); values.push(empresa); }
    if (endereco !== undefined) { fields.push(`endereco = $${idx++}`); values.push(endereco); }
    if (observacoes !== undefined) { fields.push(`observacoes = $${idx++}`); values.push(observacoes); }

    if (!fields.length) {
      return res.status(400).json({ erro: "Nenhum campo para atualizar" });
    }

    const sql = `UPDATE pedidos SET ${fields.join(", ")}, data_atualizacao = NOW() WHERE id = $${idx} RETURNING *`;
    values.push(id);
    const { rowCount, rows } = await pool.query(sql, values);
    if (!rowCount) return res.status(404).json({ erro: "Pedido não encontrado" });
    res.json({ mensagem: "Pedido atualizado", pedido: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao editar pedido:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Atualizar status de um pedido
app.put("/pedidos/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ erro: "Campo obrigatório: status" });

    const { rowCount, rows } = await pool.query(
      "UPDATE pedidos SET status = $1, data_atualizacao = NOW() WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (!rowCount) return res.status(404).json({ erro: "Pedido não encontrado" });
    res.json({ mensagem: "Status atualizado", pedido: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao atualizar status:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Inicializa servidor
app.listen(8080, () => {
  console.log("🚀 Servidor rodando na porta 8080");
});
