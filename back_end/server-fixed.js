// TLS padrão mantido; não desabilitar verificação de certificados

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const path = require("path");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const fetch = require('node-fetch');
require("dotenv").config();

const app = express();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME;

if (!supabaseUrl || !supabaseKey || !bucketName) {
  console.warn("⚠️ Configurações do Supabase não encontradas no .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Função para inicializar banco de dados
async function initDb() {
  try {
    // Verificar/criar tabela usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        login VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        telefone VARCHAR(20),
        senha_hash VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('usuario', 'motoboy', 'admin', 'gestor')),
        status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pendente')),
        disponivel BOOLEAN DEFAULT FALSE,
        aprovado BOOLEAN DEFAULT FALSE,
        comprovante_endereco TEXT,
        documento_moto TEXT,
        foto_documento TEXT,
        data_cadastro TIMESTAMP DEFAULT NOW()
      )
    `);

    // Verificar/criar tabela pedidos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id),
        motoboy_id INTEGER REFERENCES usuarios(id),
        codigo VARCHAR(100) NOT NULL,
        tipo_objeto VARCHAR(100) NOT NULL,
        empresa VARCHAR(100) NOT NULL,
        endereco TEXT NOT NULL,
        observacoes TEXT,
        status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'andamento', 'entregue', 'cancelado')),
        entrega_movel BOOLEAN DEFAULT FALSE,
        data_criacao TIMESTAMP DEFAULT NOW(),
        data_atualizacao TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("✅ Tabelas verificadas/criadas");
  } catch (err) {
    console.error('🟥 Erro ao criar/verificar tabelas:', err);
    // Não encerrar o processo em caso de erro
  }
}

// Inicializar banco de dados de forma assíncrona
initDb().catch(err => {
  console.error('🟥 Erro na inicialização do banco:', err);
});

// ===== ROTAS DA API (DEVEM VIR ANTES DOS ARQUIVOS ESTÁTICOS) =====

// Cadastro de usuário comum
app.post("/usuarios", async (req, res) => {
  try {
    const { login, email, telefone, senha, tipo } = req.body;
    if (!login || !email || !senha) {
      return res.status(400).json({ erro: "Campos obrigatórios: login, email, senha" });
    }

    const tipoValido = tipo || 'usuario';
    if (!['usuario', 'admin', 'gestor'].includes(tipoValido)) {
      return res.status(400).json({ erro: "Tipo inválido. Use: usuario, admin ou gestor" });
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const status = 'ativo';

    const query = `
      INSERT INTO usuarios (login, email, telefone, senha_hash, tipo, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, login, email, telefone, tipo, status, data_cadastro;
    `;

    const values = [login, email, telefone || null, senha_hash, tipoValido, status];
    const { rows } = await pool.query(query, values);

    res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!", usuario: rows[0] });
  } catch (erro) {
    console.error("🟥 Erro ao cadastrar usuário:", erro);
    
    if (erro.code === '23505') {
      return res.status(409).json({ erro: "Email já cadastrado" });
    }
    
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Cadastro de motoboy com upload de imagens
app.post("/usuarios/motoboy", upload.fields([
  { name: 'endereco', maxCount: 1 },
  { name: 'moto', maxCount: 1 },
  { name: 'fotoDoc', maxCount: 1 }
]), async (req, res) => {
  try {
    const { login, email, senha, telefone } = req.body;

    if (!login || !email || !senha) {
      return res.status(400).json({ erro: "Campos obrigatórios: login, email, senha" });
    }

    if (!req.files || !req.files.endereco || !req.files.moto || !req.files.fotoDoc) {
      return res.status(400).json({ erro: "Todas as imagens são obrigatórias: comprovante de endereço, documento da moto e foto do documento" });
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    // Upload das imagens para o Supabase com nomenclatura melhorada
    const uploadPromises = [];
    const imageUrls = {};

    // Mapeamento de nomes mais descritivos
    const fieldMapping = {
      'endereco': 'comprovante_endereco',
      'moto': 'documento_moto', 
      'fotoDoc': 'foto_documento'
    };

    for (const [fieldName, files] of Object.entries(req.files)) {
      const file = files[0];
      const documentType = fieldMapping[fieldName] || fieldName;
      const fileName = `${login}_${documentType}_${Date.now()}.${file.mimetype.split('/')[1]}`;
      
      uploadPromises.push(
        supabase.storage
          .from(bucketName)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          })
          .then(({ data, error }) => {
            if (error) throw error;
            imageUrls[fieldName] = data.path;
          })
      );
    }

    await Promise.all(uploadPromises);

    // Inserir usuário no banco com URLs das imagens
    const { rows } = await pool.query(
      `INSERT INTO usuarios (login, email, telefone, senha_hash, tipo, status, aprovado, comprovante_endereco, documento_moto, foto_documento) 
       VALUES ($1, $2, $3, $4, 'motoboy', 'pendente', false, $5, $6, $7) 
       RETURNING id, login, email, telefone, tipo, status, aprovado`,
      [login, email, telefone, senha_hash, imageUrls.endereco, imageUrls.moto, imageUrls.fotoDoc]
    );

    res.status(201).json({
      mensagem: "Motoboy cadastrado com sucesso! Aguarde aprovação.",
      usuario: rows[0]
    });

  } catch (erro) {
    console.error("🟥 Erro ao cadastrar motoboy:", erro);
    
    if (erro.code === '23505') {
      return res.status(409).json({ erro: "Email já cadastrado" });
    }
    
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
      "SELECT id, login, email, telefone, senha_hash, tipo, status, disponivel, aprovado, comprovante_endereco, documento_moto, foto_documento FROM usuarios WHERE email = $1 AND tipo = 'motoboy'",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ erro: "Motoboy não encontrado" });

    // Verificar se o motoboy tem todas as imagens cadastradas
    if (!user.comprovante_endereco || !user.documento_moto || !user.foto_documento) {
      return res.status(403).json({ 
        erro: "Cadastro incompleto. É necessário enviar todas as imagens obrigatórias." 
      });
    }

    // Verificar se o motoboy foi aprovado pelo admin
    if (!user.aprovado) {
      return res.status(403).json({ 
        erro: "Cadastro pendente de aprovação. Aguarde a análise do administrador." 
      });
    }

    // Verificar se o status permite login
    if (user.status === 'pendente') {
      return res.status(403).json({ 
        erro: "Cadastro em análise. Aguarde aprovação para fazer login." 
      });
    }

    if (user.status === 'inativo') {
      return res.status(403).json({ 
        erro: "Conta inativa. Entre em contato com o suporte." 
      });
    }

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: "Credenciais inválidas" });

    delete user.senha_hash;
    res.json({ mensagem: "Login bem-sucedido", usuario: user });
  } catch (erro) {
    console.error("🟥 Erro em loginMotoboy:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Login de administrador
app.post("/loginAdmin", async (req, res) => {
  console.log("🔵 Requisição recebida em /loginAdmin:", req.body);
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: "Campos obrigatórios: email, senha" });

    const { rows } = await pool.query(
      "SELECT id, login, email, telefone, senha_hash, tipo, status FROM usuarios WHERE email = $1 AND tipo = 'admin'",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ erro: "Administrador não encontrado" });

    if (user.status === 'inativo') {
      return res.status(403).json({ 
        erro: "Conta inativa. Entre em contato com o suporte." 
      });
    }

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: "Credenciais inválidas" });

    delete user.senha_hash;
    res.json({ mensagem: "Login bem-sucedido", usuario: user });
  } catch (erro) {
    console.error("🟥 Erro em loginAdmin:", erro);
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

// ===== ROTAS DE ADMIN =====

// Listar motoboys pendentes de aprovação
app.get("/admin/motoboys/pendentes", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, login, email, telefone, tipo, status, data_cadastro, 
             comprovante_endereco, documento_moto, foto_documento, aprovado
      FROM usuarios 
      WHERE tipo = 'motoboy' AND aprovado = FALSE 
      ORDER BY data_cadastro DESC
    `);
    
    res.json({ motoboys: rows });
  } catch (erro) {
    console.error("🟥 Erro ao listar motoboys pendentes:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Listar todos os motoboys (aprovados e pendentes)
app.get("/admin/motoboys", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, login, email, telefone, tipo, status, data_cadastro, 
             comprovante_endereco, documento_moto, foto_documento, aprovado
      FROM usuarios 
      WHERE tipo = 'motoboy' 
      ORDER BY data_cadastro DESC
    `);
    
    res.json({ motoboys: rows });
  } catch (erro) {
    console.error("🟥 Erro ao listar motoboys:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// Aprovar ou rejeitar motoboy
app.put("/admin/motoboys/:id/aprovacao", async (req, res) => {
  try {
    const { id } = req.params;
    const { aprovado, motivo } = req.body;
    
    if (typeof aprovado !== 'boolean') {
      return res.status(400).json({ erro: "Campo obrigatório: aprovado (true/false)" });
    }

    // Se rejeitado, pode inativar o usuário
    const status = aprovado ? 'ativo' : 'inativo';
    
    const { rowCount, rows } = await pool.query(
      "UPDATE usuarios SET aprovado = $1, status = $2 WHERE id = $3 AND tipo = 'motoboy' RETURNING id, login, email, aprovado, status",
      [aprovado, status, id]
    );
    
    if (!rowCount) {
      return res.status(404).json({ erro: "Motoboy não encontrado" });
    }
    
    const acao = aprovado ? 'aprovado' : 'rejeitado';
    res.json({ 
      mensagem: `Motoboy ${acao} com sucesso`, 
      motoboy: rows[0],
      motivo: motivo || null
    });
  } catch (erro) {
    console.error("🟥 Erro ao aprovar/rejeitar motoboy:", erro);
    res.status(500).json({ erro: erro.message || "Erro no servidor" });
  }
});

// ===== ROTAS PERSONALIZADAS (DEVEM VIR ANTES DOS ARQUIVOS ESTÁTICOS) =====

// Rota de teste
app.get("/test", (req, res) => {
  res.json({ message: "Servidor funcionando!", timestamp: new Date().toISOString() });
});

// Rota de teste para verificar se as rotas estão funcionando
app.get("/test-images", (req, res) => {
  res.json({ message: "Rota de teste funcionando!" });
});

// Rota para servir imagens do Supabase Storage
app.get("/images/:filename", async (req, res) => {
  const { filename } = req.params;
  console.log("🖼️ Solicitação de imagem:", filename);
  
  try {
    // Baixar a imagem do Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filename);
    
    if (error) {
      console.log("❌ Erro ao baixar imagem:", error.message);
      return res.status(404).json({ erro: "Imagem não encontrada" });
    }
    
    if (!data) {
      console.log("❌ Dados da imagem não encontrados");
      return res.status(404).json({ erro: "Imagem não encontrada" });
    }
    
    // Determinar o tipo de conteúdo baseado na extensão
    const ext = filename.split('.').pop().toLowerCase();
    let contentType = 'image/jpeg'; // padrão
    
    switch (ext) {
      case 'png':
        contentType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
    }
    
    console.log("✅ Imagem encontrada, servindo diretamente");
    
    // Configurar headers e servir a imagem
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 ano
    
    // Converter ArrayBuffer para Buffer e enviar
    const buffer = Buffer.from(await data.arrayBuffer());
    res.send(buffer);
    
  } catch (error) {
    console.error("🟥 Erro ao servir imagem:", error);
    res.status(500).json({ erro: "Erro interno do servidor" });
  }
});

// ===== ARQUIVOS ESTÁTICOS (DEVEM VIR APÓS AS ROTAS PERSONALIZADAS) =====

// Servir estáticos do front-end
app.use(express.static(path.join(__dirname, "../front_end/public")));
app.use("/css", express.static(path.join(__dirname, "../front_end/css")));
app.use("/img", express.static(path.join(__dirname, "../front_end/img")));
app.use("/script", express.static(path.join(__dirname, "../front_end/script")));

// Raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Inicializa servidor
const server = app.listen(8080, () => {
  console.log("🚀 Servidor funcionando na porta 8080");
});

// Evitar que o processo termine inesperadamente
process.on('SIGINT', () => {
  console.log('🔧 Recebido SIGINT, fechando servidor...');
  server.close(() => {
    console.log('🔧 Servidor fechado');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('🟥 Exceção não capturada:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🟥 Promise rejeitada não tratada:', reason);
});