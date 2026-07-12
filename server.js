const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let odadakiOyuncular = {};
const mulkKareleri = [1,2,4,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31];
let festivaller = [];

while(festivaller.length < 3) {
    let rastgele = mulkKareleri[Math.floor(Math.random() * mulkKareleri.length)];
    if(!festivaller.includes(rastgele)) festivaller.push(rastgele);
}

function odayiGuncelle(odaKodu) {
    if (odaKodu && odadakiOyuncular[odaKodu]) {
        io.to(odaKodu).emit('online-oyuncu-listesi', odadakiOyuncular[odaKodu]);
    }
}

function sirayiDegistir(odaKodu) {
    let oda = odadakiOyuncular[odaKodu];
    if (!oda || oda.length === 0) return;

    let currentIndex = oda.findIndex(o => o.id === oda.aktifSiraId);
    let nextIndex = (currentIndex + 1) % oda.length;
    
    oda.aktifSiraId = oda[nextIndex].id;
    oda.zarAttiMi = false;

    io.to(odaKodu).emit('sira-guncelle', { aktifSiraId: oda.aktifSiraId });
}

io.on('connection', (socket) => {
    console.log('Oyuncu bağlandı:', socket.id);

    socket.on('oda-degis', (yeniOda) => {
        if(socket.currentRoom) {
            socket.leave(socket.currentRoom);
            if (odadakiOyuncular[socket.currentRoom]) {
                odadakiOyuncular[socket.currentRoom] = odadakiOyuncular[socket.currentRoom].filter(o => o.id !== socket.id);
            }
        }
        socket.join(yeniOda);
        socket.currentRoom = yeniOda;
    });

    socket.on('yeni-oyuncu-katildi', (data) => {
        const oda = socket.currentRoom || "genel";
        if (!odadakiOyuncular[oda]) {
            odadakiOyuncular[oda] = [];
            odadakiOyuncular[oda].aktifSiraId = null;
            odadakiOyuncular[oda].zarAttiMi = false;
        }
        
        odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);
        let oyuncu = { id: socket.id, nick: data.nick, avatar: data.avatar, pos: 0, money: 2000000 };
        odadakiOyuncular[oda].push(oyuncu);
        
        if (!odadakiOyuncular[oda].aktifSiraId) odadakiOyuncular[oda].aktifSiraId = socket.id;
        
        socket.to(oda).emit('oyuncu-listesini-guncelle', oyuncu);
        socket.emit('mevcut-oyuncular', odadakiOyuncular[oda]);
        io.to(oda).emit('sira-guncelle', { aktifSiraId: odadakiOyuncular[oda].aktifSiraId });
        odayiGuncelle(oda);
    });

    socket.on('zar-at', () => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            if (odadakiOyuncular[oda].aktifSiraId !== socket.id || odadakiOyuncular[oda].zarAttiMi) return;
            odadakiOyuncular[oda].zarAttiMi = true;

            const zar1 = Math.floor(Math.random() * 6) + 1;
            const zar2 = Math.floor(Math.random() * 6) + 1;
            const cift = (zar1 === zar2);
            
            io.to(oda).emit('zar-sonucu', { oyuncuId: socket.id, deger: zar1 + zar2, zar1, zar2, cift });

            if (!cift) {
                setTimeout(() => sirayiDegistir(oda), 2500);
            } else {
                odadakiOyuncular[oda].zarAttiMi = false;
            }
        }
    });

    socket.on('piyon-hareket-etti', (data) => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
            if (oyuncu) oyuncu.pos = data.yeniPos;
            io.to(oda).emit('tum-oyuncular-guncellendi', odadakiOyuncular[oda]);
        }
    });

    socket.on('disconnect', () => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            if (odadakiOyuncular[oda].aktifSiraId === socket.id) sirayiDegistir(oda);
            odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);
            odayiGuncelle(oda);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor!`));