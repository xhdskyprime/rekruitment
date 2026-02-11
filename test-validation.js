
const http = require('http');

async function post(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        // Use a random boundary
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        let payload = '';

        // Add text fields
        for (const [key, value] of Object.entries(data)) {
            payload += `--${boundary}\r\n`;
            payload += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
            payload += `${value}\r\n`;
        }
        
        // Add fake files
        const files = ['suratLamaran', 'ktp', 'ijazah', 'str', 'suratPernyataan', 'pasFoto'];
        for (const fileField of files) {
            payload += `--${boundary}\r\n`;
            payload += `Content-Disposition: form-data; name="${fileField}"; filename="test.pdf"\r\n`;
            payload += `Content-Type: application/pdf\r\n\r\n`;
            payload += `fake binary content\r\n`;
        }
        
        payload += `--${boundary}--\r\n`;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ status: res.statusCode, data: parsedBody });
                    } else {
                        reject({ response: { status: res.statusCode, data: parsedBody } });
                    }
                } catch (e) {
                    reject({ response: { status: res.statusCode, data: body } });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(payload);
        req.end();
    });
}

async function testValidation() {
    const url = 'http://localhost:3000/api/register';
    
    // Test Case 1: NIK salah (kurang dari 16 digit) dan Usia terlalu tua (>35 tahun)
    const payload1 = {
        name: 'Test User Validation',
        nik: '123', // Invalid: less than 16 digits
        gender: 'Laki-laki',
        birthPlace: 'Tangerang',
        birthDate: '1980-01-01', // Invalid: too old (46 years old in 2026)
        education: 'S1',
        institution: 'Universitas Indonesia',
        major: 'Informatika',
        gpa: '3.5',
        email: 'valtest_' + Math.random().toString(36).substring(7) + '@gmail.com',
        phoneNumber: '08123456789',
        position: 'Perawat'
    };

    console.log('--- Testing Case 1: Invalid NIK and Age ---');
    try {
        const res = await post(url, payload1);
        console.log('Result Status:', res.status);
        console.log('Result Data:', JSON.stringify(res.data));
        if (res.status === 200) {
            console.log('Error: Request should have failed but succeeded');
        }
    } catch (err) {
        console.log('Error caught:', err.message || err);
        if (err.response) {
            console.log('Status:', err.response.status);
            console.log('Error Data:', err.response.data);
        }
    }

    // Test Case 2: Usia terlalu muda (<18 tahun)
    const payload2 = {
        ...payload1,
        nik: '1234567890123456',
        birthDate: '2015-01-01' // Invalid: too young (11 years old in 2026)
    };

    console.log('\n--- Testing Case 2: Too Young ---');
    try {
        await post(url, payload2);
        console.log('Error: Request should have failed but succeeded');
    } catch (err) {
        console.log('Error caught:', err.message || err);
        if (err.response) {
            console.log('Status:', err.response.status);
            console.log('Error Data:', err.response.data);
        }
    }

    // Test Case 3: Missing Fields
    const payload3 = {
        name: 'Missing Fields User'
    };

    console.log('\n--- Testing Case 3: Missing Fields ---');
    try {
        await post(url, payload3);
        console.log('Error: Request should have failed but succeeded');
    } catch (err) {
        console.log('Status:', err.response?.status);
        console.log('Error Data:', err.response?.data);
    }

    // Test Case 5: Duplicate Check (Run twice with same data)
    const payload5 = {
        name: 'Duplicate Test User',
        nik: '99' + Math.floor(Math.random() * 100000000000000).toString().padStart(14, '0'),
        gender: 'Laki-laki',
        birthPlace: 'Jakarta',
        birthDate: '1995-05-05',
        education: 'S1',
        institution: 'Universitas Indonesia',
        major: 'Informatika',
        gpa: '3.8',
        email: 'dup' + Math.random().toString(36).substring(7) + '@test.com',
        phoneNumber: '08888888888',
        position: 'Perawat'
    };

    console.log('\n--- Testing Case 5: Duplicate Check (First Run - Should Succeed or Fail if exists) ---');
    try {
        const res = await post(url, payload5);
        console.log('Result Status:', res.status);
        console.log('Result Data:', res.data);
    } catch (err) {
        console.log('Error caught in Case 5 First Run');
        if (err.response) {
            console.log('Status:', err.response.status);
            console.log('Error Data:', err.response.data);
        } else {
            console.log('Unknown Error:', err);
        }
    }

    console.log('\n--- Testing Case 5: Duplicate Check (Second Run - Should Fail) ---');
    try {
        await post(url, payload5);
        console.log('Error: Request should have failed but succeeded');
    } catch (err) {
        console.log('Status:', err.response?.status);
        console.log('Error Data:', err.response?.data);
    }
}

testValidation();
