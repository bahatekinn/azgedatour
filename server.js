const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use('/public', express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Hangi odada hangi oyuncular var ve pozisyonları ne?
let odadakiOyuncular = {}; 

const mulkKareleri = [1,2,4,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31];
let festivaller = [];
while(festivaller.length < 3) {
    let rastgele = mulkKareleri[Math.floor(Math.random() * mulkKareleri.length)];
    if(!festivaller.includes(rastgele)) festivaller.push(rastgele);
}

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);
    
    socket.on('oda-degis', (yeniOda) => {
        socket.join(yeniOda);
        socket.currentRoom = yeniOda; 
        socket.emit('festival-bilgisi', festivaller);
    });

    // YENİ OYUNCU KATILDIĞINDA
    socket.on('yeni-oyuncu-katildi', (data) => {
        if (!odadakiOyuncular[socket.currentRoom]) odadakiOyuncular[socket.currentRoom] = [];
        
        // Oyuncuya başlangıç pozisyonu (0) ekliyoruz
        let oyuncuBilgisi = { id: socket.id, nick: data.nick, avatar: data.avatar, pos: 0 };
        odadakiOyuncular[socket.currentRoom].push(oyuncuBilgisi);
        
        socket.to(socket.currentRoom).emit('oyuncu-listesini-guncelle', oyuncuBilgisi);
        socket.emit('mevcut-oyuncular', odadakiOyuncular[socket.currentRoom]);
    });

    // OYUNCU HAREKET ETTİĞİNDE POZİSYONU GÜNCELLE
    socket.on('piyon-hareket-etti', (data) => {
        if (odadakiOyuncular[socket.currentRoom]) {
            let oyuncu = odadakiOyuncular[socket.currentRoom].find(o => o.id === socket.id);
            if (oyuncu) oyuncu.pos = data.yeniPos;
            // Herkese güncel listeyi gönder ki herkes piyonları doğru yere çizsin
            io.to(socket.currentRoom).emit('tum-oyuncular-guncellendi', odadakiOyuncular[socket.currentRoom]);
        }
    });

    // SOHBET
    socket.on('mesaj-yolla', (data) => {
        if (socket.currentRoom) io.to(socket.currentRoom).emit('mesaj-al', data);
    });

    // ZAR
    socket.on('zar-at', () => {
        if (socket.currentRoom) {
            const zar1 = Math.floor(Math.random() * 6) + 1;
            const zar2 = Math.floor(Math.random() * 6) + 1;
            io.to(socket.currentRoom).emit('zar-sonucu', { 
                oyuncuId: socket.id, 
                deger: zar1 + zar2, 
                zar1: zar1, 
                zar2: zar2,
                cift: zar1 === zar2 
            });
        }
    });

    // MÜLK, UÇUŞ VE PARA
    socket.on('mulk-islem', (data) => { socket.to(socket.currentRoom).emit('mulk-islem-bilgisi', data); });
    socket.on('uctu', (data) => { socket.to(socket.currentRoom).emit('uctu-bilgisi', data); });
    socket.on('para-guncelle', (data) => { socket.to(socket.currentRoom).emit('para-guncelle-bilgisi', data); });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        // İstersen burada odadakiOyuncular listesinden silme işlemini ekleyebilirsin
    });
});

http.listen(3000, () => {
    console.log('Azgeda Tour http://localhost:3000 adresinde çalışıyor!');
});