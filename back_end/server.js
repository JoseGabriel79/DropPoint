process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const express = require("express");
const cors = require("cors"); // ✅ Importação que faltava
const { Pool } = require("pg");
require("dotenv").config(); // (opcional, mas importante para usar DATABASE_URL)

const app = express();

// Middlewares
app.use(cors()); // ✅ CORS habilitado
app.use(express.json()); // permite receber JSON no body
app.use(express.urlencoded({ extended: true }));

// Conexão com o banco PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  },
});


// ✅ Rota para adicionar usuário
app.post("/usuarios", async (req, res) => {
  const { nome, email, senha_hash, telefone, tipo, status } = req.body;

  if (!nome || !email || !senha_hash) {
    return res
      .status(400)
      .json({ erro: "Campos obrigatórios: nome, email, senha_hash" });
  }

  try {
    const query = `
      INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo, data_cadastro, status)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING *;
    `;

    const values = [nome, email, senha_hash, telefone, tipo, status];
    const { rows } = await pool.query(query, values);

    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso!",
      usuario: rows[0],
    });
  } catch (erro) {
    console.error("🟥 Erro detalhado ao inserir usuário:", erro);
    res.status(500).json({ erro: erro.message || "Erro desconhecido no servidor" });


  }
});

// Teste rápido
app.get("/", (req, res) => {
  res.send("Servidor e CORS funcionando ✅");
});

// Inicializa servidor
app.listen(8080, () => {
  console.log("🚀 Servidor rodando na porta 8080");
});
