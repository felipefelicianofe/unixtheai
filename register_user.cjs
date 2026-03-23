const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*)"/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function register() {
  const { data, error } = await supabase.auth.signUp({
    email: 'felipefeliciano.fe@gmail.com',
    password: 'asdrubal@123A',
  });

  if (error) {
    console.error('ERRO ao registrar:', error.message);
  } else {
    console.log('SUCESSO! Usuario criado:', data.user?.id);
    console.log('Email:', data.user?.email);
    console.log('Confirmado:', data.user?.confirmed_at ? 'SIM' : 'Pendente (checar email)');
  }
}

register();
