const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// YENİ: public klasörünü dışarıya açarak avatarların tarayıcıda okunmasını sağlıyoruz
app.use('/public', express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// 32 karelik haritada mülk olan yerlerin ID listesi
const mulkKareleri = [1,2,4,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31];
let festivaller = [];
while(festivaller.length < 3) {
    let rastgele = mulkKareleri[Math.floor(Math.random() * mulkKareleri.length)];
    if(!festivaller.includes(rastgele)) festivaller.push(rastgele);
}

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);

    // Bağlanan oyuncuya anında festivalleri bildir
    socket.emit('festival-bilgisi', festivaller);

    socket.on('zar-at', () => {
        const zar1 = Math.floor(Math.random() * 6) + 1;
        const zar2 = Math.floor(Math.random() * 6) + 1;
        io.emit('zar-sonucu', { 
            oyuncuId: socket.id, 
            deger: zar1 + zar2, 
            zar1: zar1, 
            zar2: zar2,
            cift: zar1 === zar2 
        });
    });

    socket.on('mulk-islem', (data) => {
        socket.broadcast.emit('mulk-islem-bilgisi', data);
    });

    socket.on('uctu', (data) => {
        socket.broadcast.emit('uctu-bilgisi', data);
    });

    socket.on('para-guncelle', (data) => {
        socket.broadcast.emit('para-guncelle-bilgisi', data);
    });
});

http.listen(3000, () => {
    console.log('Azgeda Tour http://localhost:3000 adresinde çalışıyor!');
});