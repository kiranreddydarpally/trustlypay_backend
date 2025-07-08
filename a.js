// const a = { username: '' };

// if (!a.username) {
//   console.log('if', a.username);
// } else {
//   console.log('else ', a.username);
// }
// const b = { username: undefined };

// if (!b.username) {
//   console.log('if', b.username);
// } else {
//   console.log('else ', b.username);
// }

// const c = {};
// if (!c.username) {
//   console.log('if', c.username);
// } else {
//   console.log('else ', c.username);
// }

// const d = { username: 'o' };
// if (!d.username) {
//   console.log('if', d.username);
// } else {
//   console.log('else ', d.username);
// }
import dayjs from 'dayjs';

import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
console.log(new Date());
console.log(dayjs());

console.log(dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'));
console.log(dayjs().tz('Asia/Kolkata'));
