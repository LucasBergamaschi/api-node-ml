const express = require('express');
const app = express();
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const db = require('./database'); // Importa a conexão com o SQLite
require('dotenv').config();

const logStream = fs.createWriteStream('logs.txt', { flags: 'a' });

console.log = (...args) => {
    const logMessage = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
    process.stdout.write(logMessage);
    logStream.write(logMessage);
};

console.error = (...args) => {
    const errorMessage = `[${new Date().toISOString()}] [ERROR] ${args.join(' ')}\n`;
    process.stderr.write(errorMessage);
    logStream.write(errorMessage);
};

// Configurar o diretório de arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

async function getAuth() {
    console.log("🔄 Atualizando token...");
    const app_id = "7068339412785747";
    const client_secret = "O7DsBVaA851Tf1WBZC8byQdlpaUbVu3x";

    try {
        const resultado = await new Promise((resolve, reject) => {
            db.get('SELECT refresh_token FROM tokens_ml WHERE id = 1;', [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!resultado) {
            console.error("❌ Nenhum refresh_token encontrado!");
            return null;
        }

        const refresh_token_antigo = resultado.refresh_token;
        console.log("🔄 Renovando token...");

        const resposta = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: 'POST',
            headers: { "accept": "application/json", "content-type": "application/x-www-form-urlencoded" },
            body: `grant_type=refresh_token&client_id=${app_id}&client_secret=${client_secret}&refresh_token=${refresh_token_antigo}`
        });

        const resposta_json = await resposta.json();

        if (resposta_json.error) {
            console.error("❌ Erro ao renovar token:", resposta_json.error);
            return null;
        }

        const expires_at = Date.now() + (resposta_json.expires_in * 1000);
        await new Promise((resolve, reject) => {
            db.run(`UPDATE tokens_ml SET refresh_token = ?, access_token = ?, expires_at = ? WHERE id = 1;`,
                [resposta_json.refresh_token, resposta_json.access_token, expires_at], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        return resposta_json.access_token;
    } catch (err) {
        console.error("❌ Erro ao obter token:", err.message);
    }
}

async function getVendas(access_token) {
    const seller_id = "530696397";
    const url = `https://api.mercadolibre.com/orders/search?seller=${seller_id}`;
    const resposta = await fetch(url, { method: 'GET', headers: { "Authorization": `Bearer ${access_token}` } });
    return await resposta.json();
}

async function salvarVendas(dados) {
    if (!dados || !Array.isArray(dados.results)) {
        console.error("Erro: 'dados.results' não é um array válido!", dados);
        return;
    }

    for (let venda of dados.results) {
        const data_venda = venda.date_closed;
        const id_venda = venda.id;
        const produto_nome = venda.order_items[0]?.item?.title || "Desconhecido";
        const quantidade = venda.order_items[0]?.quantity || 1;
        const valor_total = venda.total_amount || 0;
        const taxa_ml = venda.order_items[0]?.sale_fee || 0;
        const custo_frete = venda.shipping?.cost || 0;
        const valor_liquido = valor_total - (taxa_ml + custo_frete);
        const status_pedido = venda.status || "Desconhecido";
        const status_entrega = venda.shipping?.status || "Desconhecido";

        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO vendas_ml (data_venda, id_venda, produto_nome, quantidade, valor_total, taxa_ml, custo_frete, valor_liquido, status_pedido, status_entrega) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [data_venda, id_venda, produto_nome, quantidade, valor_total, taxa_ml, custo_frete, valor_liquido, status_pedido, status_entrega],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
}

app.get('/getVendas', async (req, res) => {
    try {
        const access_token = await getAuth();
        if (!access_token) return res.status(500).send("Erro ao obter token.");

        const resultadoVendas = await getVendas(access_token);
        await salvarVendas(resultadoVendas);

        res.json({ message: "Vendas recuperadas e salvas com sucesso!", vendas: resultadoVendas });
    } catch (error) {
        console.error("Erro ao buscar vendas:", error.message);
        res.status(500).send("Erro ao buscar vendas.");
    }
});

// Definir a porta correta para rodar no Railway ou localmente
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT} - http://localhost:${PORT}`);
});
