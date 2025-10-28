process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
const sslOpt = process.env.DATABASE_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false;
if (!connectionString) {
  console.warn("⚠️ DATABASE_URL não definido. Configure back_end/.env antes de usar rotas que acessam o banco.");
}
const pool = new Pool({ connectionString, ssl: sslOpt });

// Servir estáticos do front-end
app.use(express.static(path.join(__dirname, "../front_end/public")));
app.use("/css", express.static(path.join(__dirname, "../front_end/css")));
app.use("/img", express.static(path.join(__dirname, "../front_end/img")));

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
      "SELECT id, login, email, telefone, senha_hash, tipo, status FROM usuarios WHERE email = $1 AND tipo = 'motoboy'",
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

// Criar pedido
app.post("/pedidos", async (req, res) => {
  try {
    const { usuario_id, codigoPedido, tipoObjeto, empresa, endereco, observacoes } = req.body;
    if (!usuario_id || !codigoPedido || !tipoObjeto || !empresa || !endereco) {
      return res.status(400).json({ erro: "Campos obrigatórios: usuario_id, codigoPedido, tipoObjeto, empresa, endereco" });
    }

    const query = `
      INSERT INTO pedidos (usuario_id, codigo, tipo_objeto, empresa, endereco, observacoes, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pendente')
      RETURNING *;
    `;
    const values = [usuario_id, codigoPedido, tipoObjeto, empresa, endereco, observacoes || null];
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
    const { usuario_id, status } = req.query;
    let sql = "SELECT * FROM pedidos";
    const params = [];
    const conds = [];
    if (usuario_id) { conds.push("usuario_id = $" + (params.push(usuario_id))); }
    if (status) { conds.push("status = $" + (params.push(status))); }
    if (conds.length) sql += " WHERE " + conds.join(" AND ");
    sql += " ORDER BY data_criacao DESC";

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (erro) {
    console.error("🟥 Erro ao listar pedidos:", erro);
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
