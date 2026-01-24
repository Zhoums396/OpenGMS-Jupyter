const axios = require('axios');

const API_BASE_URL = 'http://223.2.34.7:8080';
const API_TOKEN = '883ada2fc996ab9487bed7a3ba21d2f1';

async function testApi() {
    try {
        console.log('Testing connection to:', API_BASE_URL);
        const response = await axios.get(`${API_BASE_URL}/container/method/listWithTag`, {
            params: { page: 1, limit: 5 },
            headers: { 'token': API_TOKEN }
        });
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }
}

testApi();
