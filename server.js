const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use('/public', express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Hangi odada hangi oyuncular var onu tutalım
let odadakiOyuncular = {}; 

const mulkKareleri = [1,2,4,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31];
let festivaller = [];
while(festivaller.length < 3) {
    let rastgele = mulkKareleri[Math.floor(Math.random() * mulkKareleri.length)];
    if(!festivaller.includes(rastgele)) festivaller.push(rastgele);
}

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);
    
    // ODA KODU VE OYUNCU BİLGİSİ
    socket.on('oda-degis', (yeniOda) => {
        socket.join(yeniOda);
        socket.currentRoom = yeniOda; 
        socket.emit('festival-bilgisi', festivaller);
    });

    // YENİ OYUNCU KATILDIĞINDA (Bunu index.html'den çağırman lazım)
    socket.on('yeni-oyuncu-katildi', (data) => {
        if (!odadakiOyuncular[socket.currentRoom]) odadakiOyuncular[socket.currentRoom] = [];
        
        let oyuncuBilgisi = { id: socket.id, nick: data.nick, avatar: data.avatar };
        odadakiOyuncular[socket.currentRoom].push(oyuncuBilgisi);
        
        // Diğerlerine yeni oyuncuyu haber ver
        socket.to(socket.currentRoom).emit('oyuncu-listesini-guncelle', oyuncuBilgisi);
        
        // Yeni gelene de odadakileri gönder
        socket.emit('mevcut-oyuncular', odadakiOyuncular[socket.currentRoom]);
    });

    // SOHBET
    socket.on('mesaj-yolla', (data) => {
        if (socket.currentRoom) {
            io.to(socket.currentRoom).emit('mesaj-al', data);
        }
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

    // MÜLK, UÇUŞ VE PARA (Diğerleri aynı)
    socket.on('mulk-islem', (data) => { socket.to(socket.currentRoom).emit('mulk-islem-bilgisi', data); });
    socket.on('uctu', (data) => { socket.to(socket.currentRoom).emit('uctu-bilgisi', data); });
    socket.on('para-guncelle', (data) => { socket.to(socket.currentRoom).emit('para-guncelle-bilgisi', data); });

    // Çıkış yapınca listeden sil
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        // İstersen burada odadakiOyuncular listesinden de silebilirsin
    });
});

http.listen(3000, () => {
    console.log('Azgeda Tour http://localhost:3000 adresinde çalışıyor!');
});