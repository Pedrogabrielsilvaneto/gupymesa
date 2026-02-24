import { chromium } from 'playwright';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runAutomation() {
    console.log('🚀 Iniciando automação de importação diária...');

    const yesterday = DateTime.now().minus({ days: 1 });
    const dateFormatted = yesterday.toFormat('ddMMyyyy'); // ddmmaaaa.csv
    const year = yesterday.year;
    const monthName = yesterday.setLocale('pt-BR').monthLong;
    const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const targetDir = `C:\\Users\\Pedro Neto\\Desktop\\APLICATIVOS\\Diversos\\APP GUPY\\Produção\\${year}\\${monthCapitalized}`;
    const fileName = `${dateFormatted}.csv`;
    const fullPath = path.join(targetDir, fileName);

    console.log(`📅 Data de referência: ${yesterday.toFormat('dd/MM/yyyy')}`);
    console.log(`📂 Pasta destino: ${targetDir}`);

    if (!fs.existsSync(targetDir)) {
        console.log('📁 Criando pasta do mês...');
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const userDataDir = `C:\\Users\\Pedro Neto\\AppData\\Local\\Google\\Chrome\\User Data`;
    const profile = 'Default'; // Conforme identificado no Local State

    const context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false, // Precisa ser visível para garantir carregamento de perfil e lidar com auth
        args: [
            `--profile-directory=${profile}`,
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    try {
        // --- PARTE 1: METABASE ---
        console.log('🌐 Acessando Metabase...');
        await page.goto('https://metabase.app.internal.gupy.io/question/5752', { waitUntil: 'networkidle' });

        // Seleção de data no Metabase
        // Nota: Seletores do Metabase podem variar. Tentando encontrar o filtro de data.
        console.log('🔍 Selecionando data de ontem...');

        // Clica no filtro de data (geralmente tem um ícone de calendário ou texto de data)
        const dateFilterSelector = 'div.FilterValue'; // Seletor genérico do Metabase
        await page.click('text=/Ontem|Yesterday|Data/'); // Tenta achar por texto se o seletor falhar

        // Aqui o Metabase abre um dropdown. Precisamos garantir que "Ontem" ou a data específica seja selecionada.
        // Se houver um input, podemos digitar:
        // await page.fill('input[placeholder*="Data"]', yesterday.toFormat('dd/MM/yyyy'));

        // Para simplificar, se o dashboard já estiver configurado para "Ontem" por padrão, só precisamos baixar.
        // Se precisar clicar no botão de baixar:
        console.log('📥 Baixando CSV...');
        await page.click('button[aria-label="Download"], .DownloadButton, i.download'); // Seletores comuns

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('text=CSV') // Clica na opção CSV
        ]);

        await download.saveAs(fullPath);
        console.log(`✅ Arquivo salvo em: ${fullPath}`);

        // --- PARTE 2: APP GUPYMESA ---
        console.log('🌐 Acessando GupyMesa Vercel...');
        await page.goto('https://gupymesa.vercel.app/produtividade.html', { waitUntil: 'networkidle' });

        // Importação do arquivo
        console.log('📤 Importando arquivo no sistema...');

        // O input de arquivo geralmente é <input type="file" id="import-csv-prod">
        const fileInputSelector = '#import-csv-prod';
        await page.setInputFiles(fileInputSelector, fullPath);

        // O app GupyMesa pede confirmação (window.confirm)
        page.on('dialog', async dialog => {
            console.log(`💬 Diálogo: ${dialog.message()}`);
            await dialog.accept(); // Aceita todas as confirmações (Duplicidade, Resumo, Gravação)
        });

        // Espera um pouco para garantir que os scripts processem
        await page.waitForTimeout(5000);

        console.log('🏁 Automação concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro na automação:', error);
    } finally {
        await context.close();
    }
}

runAutomation();
