const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_TOKEN = '883ada2fc996ab9487bed7a3ba21d2f1';
const BASE_IP = '172.21.252.222';

const CANDIDATES = [
    `http://${BASE_IP}:8080/dataTransferServer/data`,
    `http://${BASE_IP}:8080/container/data`,
    `http://${BASE_IP}:8080/geoserver/data`,
    `http://${BASE_IP}:8080/data`,
    `http://${BASE_IP}:8081/dataTransferServer/data`,
    `http://${BASE_IP}:8081/data`,
    `http://${BASE_IP}:8083/dataTransferServer/data`, // Hint from SDK (8083)
    `http://${BASE_IP}:8083/data`,
    `http://${BASE_IP}:8088/dataTransferServer/data`,
    `http://${BASE_IP}:8088/data`
];

async function testSingleUrl(url) {
    console.log(`\nTesting: ${url}`);
    const filePath = path.join(__dirname, 'test_file.txt');
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, 'test content');

    try {
        const form = new FormData();
        form.append('datafile', fs.createReadStream(filePath));
        form.append('name', 'test_file.txt');

        const response = await axios.post(url, form, {
            headers: { ...form.getHeaders(), 'token': API_TOKEN },
            timeout: 3000
        });

        if (response.status === 200) {
            console.log('✅ SUCCESS!');
            console.log('Response:', JSON.stringify(response.data, null, 2));
            return true;
        }
    } catch (error) {
        const status = error.response ? error.response.status : (error.code || error.message);
        console.log(`❌ Failed (${status})`);
    }
    return false;
}

async function runProbes() {
    console.log(`Starting probes on ${BASE_IP}...`);
    for (const url of CANDIDATES) {
        if (await testSingleUrl(url)) {
            console.log(`\n🎉 FOUND VALID ENDPOINT: ${url}`);
            break;
        }
    }
    // Cleanup
    const filePath = path.join(__dirname, 'test_file.txt');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

runProbes();
