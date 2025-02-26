const fetch = require("node-fetch");

async function chamarApi() {
    const API_URL = process.env.API_URL || "https://api-node-ml-production.up.railway.app/getVendas";
    try {
        const resposta = await fetch(API_URL);
        console.log(`🔄 API chamada com sucesso: ${resposta.status}`);
    } catch (error) {
        console.error("❌ Erro ao chamar a API:", error.message);
    }
}

// Executa a função a cada 1 hora
setInterval(chamarApi, 3600000);

// Chama a API uma vez ao iniciar
chamarApi();
