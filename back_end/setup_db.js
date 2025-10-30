// TLS padrão mantido; não desabilitar verificação de certificados

const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;
const needsSSL = (process.env.DATABASE_SSL === 'true') || /neon\.tech|sslmode=require/i.test(connectionString || '');
// Forçar desabilitar verificação de certificado no setup para funcionar em ambientes com certificado self-signed
const sslOpt = { rejectUnauthorized: false };

if (!connectionString) {
  console.error("❌ DATABASE_URL não definido. Crie um arquivo .env em back_end/ com sua string de conexão.");
  console.error("Exemplo: postgres://usuario:senha@host:5432/banco | e defina DATABASE_SSL=true se seu provedor exigir SSL (ex.: Neon)");
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: sslOpt });

const sql = `
-- Usuários (clientes e motoboys)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  login VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(20),
  senha_hash TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'usuario', -- 'usuario' | 'motoboy'
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  disponivel BOOLEAN NOT NULL DEFAULT FALSE,
  comprovante_endereco TEXT,
  documento_moto TEXT,
  foto_documento TEXT,
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo VARCHAR(100) NOT NULL,
  tipo_objeto VARCHAR(30) NOT NULL,
  empresa VARCHAR(50) NOT NULL,
  endereco TEXT NOT NULL,
  observacoes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente'|'andamento'|'finalizado'|'cancelado'
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pedidos_usuario_codigo_unique UNIQUE (usuario_id, codigo)
);
`;

(async () => {
  const client = await pool.connect();
  try {
    console.log("📦 Iniciando criação de tabelas...");
    await client.query(sql);
    console.log("✅ Tabelas criadas/verificadas com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao criar tabelas:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();