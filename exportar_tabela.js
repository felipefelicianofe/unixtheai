import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Ler o .env e extrair chaves do VITE
const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*)/);
  if (match) {
    let val = match[2];
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    envVars[match[1]] = val;
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
// Ao utilizar chave Publishable, ela tem as definições diretas de Anon do banco
const SUPABASE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERRO FALTAL: VITE_SUPABASE_URL ou PUBLISHABLE_KEY (Anon) não encontrados no .env!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE_NAME = 'management_indicator_performance';
const OUTPUT_FILE = 'tabela_gigante.csv';
const CHUNK_SIZE = 5000;

async function runExport() {
  console.log(`Iniciando conexão à base Supabase via Anon_Key. Tabela Alvo: ${TABLE_NAME}`);
  
  const { count, error: countError } = await supabase
    .from(TABLE_NAME)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error("Erro ao obter a contagem da tabela. O erro apontado pela API foi:", countError);
    return;
  }

  const totalLines = count || 0;
  console.log(`Identificados [${totalLines}] registros no banco de dados para iniciar os ciclos R/W.`);

  if (totalLines === 0) {
    console.log("Atenção: A contagem retornou 0 linhas. Verifique se as linhas não estão deletadas ou se a tabela realmente possui dados nesta Collection atual.");
    return;
  }

  if (fs.existsSync(OUTPUT_FILE)) {
    console.log(`Detectando limpeza cíclica! Excluindo CSV anterior para recriar base indexada.`);
    fs.unlinkSync(OUTPUT_FILE);
  }

  let offset = 0;
  let headersWritten = false;

  while (offset < totalLines) {
    const limit = offset + CHUNK_SIZE - 1;
    
    // Executando extração paginada e segura (Safe Limit memory)
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .range(offset, limit);

    if (error) {
      console.error(`Abortado por falha no bloco [${offset} - ${limit}] > Rastro:`, error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      break; // Sai do ciclo em caso de interrupção ou null pointer exception dos dados
    }

    let csvContent = '';

    // Indexar cabeçario CSV
    if (!headersWritten && data.length > 0) {
      const headers = Object.keys(data[0]);
      csvContent += headers.join(',') + '\n';
      headersWritten = true;
    }

    // Normalização das linhas injetando proteção em blocos JSON contendo vírgulas nativamente
    for (const row of data) {
      const values = Object.values(row).map(val => {
        if (val === null || val === undefined) return '';
        let strVal = String(val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          strVal = `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      csvContent += values.join(',') + '\n';
    }

    // Flush de memoria imediato p/ Arquivo e limpa string builder
    fs.appendFileSync(OUTPUT_FILE, csvContent, 'utf-8');

    // Cálculo exato da porcentagem do ciclo
    offset += data.length;
    let percentage = ((offset / totalLines) * 100).toFixed(2);
    console.log(`⚙️ Progresso em andamento: ${percentage}%... Lançados ${offset} de ${totalLines} registros.`);

    // Delay de 85ms para o Limit Rate Network (Previnir Ban da API do Supabase/Cloudflare limit bypass)
    await new Promise(resolve => setTimeout(resolve, 85));
  }

  console.log(`🏆 SUCESSO! Carga completa das linhas na memória concluída. Salvo como: ${OUTPUT_FILE}`);
}

runExport();
