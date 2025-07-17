import axios from 'axios';

const URL = 'http://localhost:3000/api/payout/direct/payoutTransfer';

const CONCURRENCY = 5;

function generateAmount(i) {
  return Math.floor(Math.random() * 1000) + 1;
}

async function fireRequest(i) {
  const obj = {
    clientId: 'TP_live_gC7KkRBRQCdtssWK',
    name: 'test',
    email: 'tess@gmail.com',
    phone: '8484848484',
    amount: generateAmount(i).toString(),
    transferMode: 'IMPS',
    account_no: '258701000002329',
    ifsc_code: 'IOBA0002587',
    acc_holder_name: 'test',
    bank_name: 'SBI',
    upi: '',
    purpose: 'test',
    udf1: 'OrderID2434',
  };

  let encrypt = '';
  try {
    encrypt = await axios.post(
      'http://localhost:3000/api/payout/Payout-encrypt-AES128ECB/ap7Kl5WMOOftanNu',
      obj,
    );
    console.log(
      ` Req ${i} | data: ${encrypt?.data} | Status: ${encrypt?.status}`,
    );
  } catch (err) {
    const msg =
      err.response?.data?.message || err.response?.statusText || err.message;
    console.error(
      ` Req ${i} | data: ${encrypt.response?.data} | Error: ${msg}`,
    );
  }

  try {
    const res = await axios.post(URL, {
      clientId: 'TP_live_gC7KkRBRQCdtssWK',
      encrypt: encrypt.data,
    });
    console.log(` Req ${i} | Amount: ${obj.amount} | Status: ${res.status}`);
  } catch (err) {
    const msg =
      err.response?.data?.message || err.response?.statusText || err.message;
    console.error(` Req ${i} | Amount: ${obj.amount} | Error: ${msg}`);
  }
}

// // Fire all requests concurrently
(async () => {
  const tasks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    tasks.push(fireRequest(i + 1));
  }
  await Promise.all(tasks);
})();
