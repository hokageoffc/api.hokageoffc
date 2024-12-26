const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { createPaydisini, checkPaymentStatus, cancelTransaction, cancelTransactionOrkut } = require('./scrape');
const generateQRIS = require('./generateQRIS');
const { createQRIS } = require('./qris');
const VALID_API_KEYS = ['hokageoffc']; // Ganti dengan daftar API key yang valid

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/paydisini/create-payment', async (req, res) => {
  const { amount, keypaydis, return_url, type_fee, valid_time } = req.query;

  if (!amount || !keypaydis || !return_url || !type_fee || !valid_time) {
    return res.status(400).send('Semua parameter (amount, keypaydis, return_url, type_fee, valid_time) harus diisi.');
  }

  try {
    const uniqueCode = Math.random().toString(36).substring(2, 12);
    const service = "11";

    const signature = crypto
      .createHash("md5")
      .update(keypaydis + uniqueCode + service + amount + valid_time + "NewTransaction")
      .digest("hex");

    const result = await createPaydisini(amount, keypaydis, return_url, type_fee, valid_time, uniqueCode, signature);
    if (result.success) {
      const qrContent = result.data.data.qr_content;
      const qrImage = await generateQRIS(qrContent);

      result.data.data.qrcode_url = qrImage.qrImageUrl;
      result.data.data.signature = signature;

      res.send(`
        Status: ${result.data.success} 
        Message: ${result.data.msg} 
        Data: ${JSON.stringify({ ...result.data.data, amount, keypaydis, return_url, type_fee, valid_time, unique_code: uniqueCode })}
      `);
    } else {
      res.status(500).send(`Error: ${result.error}`);
    }
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/paydisini/check-payment-status', async (req, res) => {
  const { keypaydis, unique_code, signature } = req.query;

  if (!keypaydis || !unique_code || !signature) {
    return res.status(400).send('Semua parameter (keypaydis, unique_code, signature) harus diisi.');
  }

  try {
    const result = await checkPaymentStatus(keypaydis, unique_code, signature);
    res.send(`
      Status: ${result.success}
      Data: ${JSON.stringify({ ...result.data, keypaydis, unique_code, signature })}
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/paydisini/cancel-payment', async (req, res) => {
  const { keypaydis, unique_code, signature } = req.query;

  if (!keypaydis || !unique_code || !signature) {
    return res.status(400).send('Semua parameter (keypaydis, unique_code, signature) harus diisi.');
  }

  try {
    const result = await cancelTransaction(keypaydis, unique_code, signature);
    res.send(`
      Status: ${result.success}
      Data: ${JSON.stringify({ ...result.data, keypaydis, unique_code, signature })}
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/orkut/createpayment', async (req, res) => {
  const { apikey, amount, codeqr } = req.query;

  if (!apikey || !VALID_API_KEYS.includes(apikey)) {
    return res.status(401).send('API key tidak valid atau tidak disertakan.');
  }

  if (!amount) {
    return res.send('Isi Parameter Amount.');
  }

  if (!codeqr) {
    return res.send('Isi Parameter Token menggunakan codeqr kalian.');
  }

  try {
    const qrisData = await createQRIS(amount, codeqr);
    res.send(`QRIS Data: ${JSON.stringify(qrisData)}`);
  } catch (error) {
    res.status(500).send(`Error generating QRIS: ${error.message}`);
  }
});

app.get('/orkut/checkpayment', async (req, res) => {
  const { apikey, merchant, token } = req.query;

  if (!apikey || !VALID_API_KEYS.includes(apikey)) {
    return res.status(401).send('API key tidak valid atau tidak disertakan.');
  }

  if (!merchant) {
    return res.send('Isi Parameter Merchant.');
  }

  if (!token) {
    return res.send('Isi Parameter Token menggunakan codeqr kalian.');
  }

  try {
    const apiUrl = `https://gateway.okeconnect.com/api/mutasi/qris/${merchant}/${token}`;
    const response = await axios.get(apiUrl);
    const latestTransaction = response.data.data[0];
    res.send(`Latest Transaction: ${JSON.stringify(latestTransaction)}`);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.post('/orkut/cancel', (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).send('Parameter transactionId harus diisi.');
  }

  try {
    const BatalTransaksi = cancelTransactionOrkut(transactionId);
    res.send(`Success: ${JSON.stringify(BatalTransaksi)}`);
  } catch (error) {
    res.status(400).send(`Error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});