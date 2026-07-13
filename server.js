   const express = require('express');

const app = express();

const http = require('http').createServer(app);

const io = require('socket.io')(http);

process.on('uncaughtException', (err) => {

console.error('Sunucu Hatası:', err);

});


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



// Bir odadaki herkese güncel online listesini ve paralarını göndermek için yardımcı fonksiyon

function odayiGuncelle(odaKodu) {

    if (odaKodu && odadakiOyuncular[odaKodu]) {

        io.to(odaKodu).emit('online-oyuncu-listesi', odadakiOyuncular[odaKodu]);

    }

}



// Sırayı bir sonraki oyuncuya geçiren yardımcı fonksiyon

// Sırayı bir sonraki oyuncuya geçiren yardımcı fonksiyon (GÜNCEL)
function sirayiDegistir(odaKodu) {
    let oda = odadakiOyuncular[odaKodu];
    if (!oda || oda.length === 0) return;

    // Mevcut oyuncunun indeksini bul
    let currentIndex = oda.findIndex(o => o.id === oda.aktifSiraId);
    
    // Eğer oyuncu bulunamazsa (hata durumu), sırayı ilk oyuncuya ver
    if (currentIndex === -1) currentIndex = 0;
    
    let nextIndex = (currentIndex + 1) % oda.length;
    
    // Sırayı güncelle ve zar hakkını sıfırla
    oda.aktifSiraId = oda[nextIndex].id;
    oda.zarAttiMi = false; 

    // ÖNEMLİ: Tüm odaya yeni sıra bilgisini gönder
    // Bu mesajı alan istemciler zar butonunu otomatik olarak açıp kapatmalı
    io.to(odaKodu).emit('sira-guncelle', { 
        aktifSiraId: oda.aktifSiraId,
        mesaj: "Sıra değişti" 
    });
    
    console.log(`Oda ${odaKodu}: Sıra ${oda.aktifSiraId} ID'li oyuncuya geçti.`);
}
// --- TÜM SOCKET OLAYLARI BU PARANTEZİN İÇİNDE OLMALI ---
io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);

    socket.on('oda-degis', (yeniOda) => {
        if(socket.currentRoom) {
            socket.leave(socket.currentRoom);
            if (odadakiOyuncular[socket.currentRoom]) {
                let eskiOda = socket.currentRoom;
                odadakiOyuncular[eskiOda] = odadakiOyuncular[eskiOda].filter(o => o.id !== socket.id);
                if (odadakiOyuncular[eskiOda].aktifSiraId === socket.id) sirayiDegistir(eskiOda);
                odayiGuncelle(eskiOda);
            }
        }
        socket.join(yeniOda);
        socket.currentRoom = yeniOda;
        socket.emit('festival-bilgisi', festivaller);
        if (odadakiOyuncular[yeniOda] && odadakiOyuncular[yeniOda].dunyaSampiyonasiSehirId !== undefined) {
            socket.emit('sampiyona-guncelle', { sehirId: odadakiOyuncular[yeniOda].dunyaSampiyonasiSehirId });
        }
    });

    socket.on('yeni-oyuncu-katildi', (data) => {
        const oda = socket.currentRoom || "genel";
        if (!odadakiOyuncular[oda]) {
            odadakiOyuncular[oda] = [];
            odadakiOyuncular[oda].aktifSiraId = socket.id;
        }
        odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);
        let oyuncuBilgisi = { id: socket.id, nick: data.nick || `Oyuncu_${Math.floor(Math.random()*100)}`, avatar: data.avatar, pos: 0, money: 2000000 };
        odadakiOyuncular[oda].push(oyuncuBilgisi);
        socket.to(oda).emit('oyuncu-listesini-guncelle', oyuncuBilgisi);
        socket.emit('mevcut-oyuncular', odadakiOyuncular[oda]);
        io.to(oda).emit('sira-guncelle', { aktifSiraId: odadakiOyuncular[oda].aktifSiraId });
        odayiGuncelle(oda);
    });

    socket.on('piyon-hareket-etti', (data) => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
            if (oyuncu) oyuncu.pos = data.yeniPos;
            io.to(oda).emit('tum-oyuncular-guncellendi', odadakiOyuncular[oda]);
        }
    });

    socket.on('mesaj-yolla', (data) => {
        if (socket.currentRoom) io.to(socket.currentRoom).emit('mesaj-al', data);
    });

    socket.on('zar-at', () => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda] && odadakiOyuncular[oda].aktifSiraId === socket.id) {
            odadakiOyuncular[oda].zarAttiMi = true;
            let zar1 = Math.floor(Math.random() * 6) + 1;
            let zar2 = Math.floor(Math.random() * 6) + 1;
            io.to(oda).emit('zar-sonucu', { oyuncuId: socket.id, deger: zar1 + zar2, zar1, zar2, cift: (zar1 === zar2) });
            if (zar1 !== zar2) setTimeout(() => sirayiDegistir(oda), 2500);
            else odadakiOyuncular[oda].zarAttiMi = false;
        }
    });

    socket.on('sampiyona-ilan-et', (data) => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            odadakiOyuncular[oda].dunyaSampiyonasiSehirId = data.sehirId;
            socket.to(oda).emit('sampiyona-guncelle', { sehirId: data.sehirId });
        }
    });

    socket.on('mulk-islem', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('mulk-islem-bilgisi', data);
            io.to(socket.currentRoom).emit('tum-oyuncular-guncellendi', odadakiOyuncular[socket.currentRoom]);
        }
    });

    socket.on('para-guncelle', (data) => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
            if (oyuncu) oyuncu.money = data.yeniPara;
            socket.to(oda).emit('para-guncelle-bilgisi', { id: socket.id, yeniPara: data.yeniPara });
            odayiGuncelle(oda);
        }
    });

    socket.on('takas-teklifi-gonder', (data) => { socket.to(data.aliciId).emit('takas-teklifi-al', data); });
    socket.on('takas-cevabi-ver', (data) => { socket.to(data.gonderenId).emit('takas-sonuc-bilgisi', data); });

    socket.on('disconnect', () => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            if (odadakiOyuncular[oda].aktifSiraId === socket.id) sirayiDegistir(oda);
            odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);
            odayiGuncelle(oda);
        }
    });
}); // <--- io.on parantezi buraya geldi!
// Render veya yerel port için dinamik port kontrolü
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Azgeda Tour ${PORT} portunda başarıyla çalışıyor!`);
});