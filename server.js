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

// Bir odadaki herkese güncel online listesini ve paralarını göndermek için yardımcı fonksiyon
function odayiGuncelle(odaKodu) {
    if (odaKodu && odadakiOyuncular[odaKodu]) {
        io.to(odaKodu).emit('online-oyuncu-listesi', odadakiOyuncular[odaKodu]);
    }
}

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);
    
    // 1. ODA DEĞİŞTİRME / ODAYA GİRİŞ (Her şeyden önce bu çalışmalı)
    socket.on('oda-degis', (yeniOda) => {
        // Eğer zaten bir odadaysa önce eski odadan çıkış yapsın
        if(socket.currentRoom) {
            socket.leave(socket.currentRoom);
            if (odadakiOyuncular[socket.currentRoom]) {
                odadakiOyuncular[socket.currentRoom] = odadakiOyuncular[socket.currentRoom].filter(o => o.id !== socket.id);
                odayiGuncelle(socket.currentRoom);
            }
        }

        socket.join(yeniOda);
        socket.currentRoom = yeniOda; 
        socket.emit('festival-bilgisi', festivaller);
    });

    // 2. OYUNCU BİLGİLERİYLE KATILDIĞINDA
    socket.on('yeni-oyuncu-katildi', (data) => {
        const oda = socket.currentRoom || "genel";
        if (!odadakiOyuncular[oda]) odadakiOyuncular[oda] = [];
        
        // Eğer bu ID odada zaten varsa mükerrer olmasın diye temizle
        odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);

        let oyuncuBilgisi = { 
            id: socket.id, 
            nick: data.nick || `Oyuncu_${Math.floor(Math.random()*100)}`, 
            avatar: data.avatar, 
            pos: 0,
            money: 2000000 // Başlangıç net serveti sıralama için
        };
        
        odadakiOyuncular[oda].push(oyuncuBilgisi);
        
        // Odadaki diğer arkadaşlarına yeni birinin geldiğini bildir
        socket.to(oda).emit('oyuncu-listesini-guncelle', oyuncuBilgisi);
        
        // Kendisine odada halihazırda bekleyen oyuncuları gönder
        socket.emit('mevcut-oyuncular', odadakiOyuncular[oda]);

        // Herkese güncel online listesini fırlat (Böylece panellerde anlık gözükeceksiniz)
        odayiGuncelle(oda);
    });

    // 3. OYUNCU HAREKET ETTİĞİNDE POZİSYONU GÜNCELLE
    socket.on('piyon-hareket-etti', (data) => {
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
            if (oyuncu) oyuncu.pos = data.yeniPos;
            
            io.to(oda).emit('tum-oyuncular-guncellendi', odadakiOyuncular[oda]);
        }
    });

    // SOHBET (Odaya özel)
    socket.on('mesaj-yolla', (data) => {
        if (socket.currentRoom) io.to(socket.currentRoom).emit('mesaj-al', data);
    });

    // ZAR (Odaya özel)
    socket.on('zar-at', () => {
        const oda = socket.currentRoom;
        if (oda) {
            const zar1 = Math.floor(Math.random() * 6) + 1;
            const zar2 = Math.floor(Math.random() * 6) + 1;
            
            io.to(oda).emit('zar-sonucu', { 
                oyuncuId: socket.id, 
                deger: zar1 + zar2, 
                zar1: zar1, 
                zar2: zar2,
                cift: zar1 === zar2 
            });
        }
    });

    // MÜLK, UÇUŞ VE PARA GÜNCELLEMELERİ
    socket.on('mulk-islem', (data) => { if (socket.currentRoom) socket.to(socket.currentRoom).emit('mulk-islem-bilgisi', data); });
    socket.on('uctu', (data) => { if (socket.currentRoom) socket.to(socket.currentRoom).emit('uctu-bilgisi', data); });
    
    // Para güncellendiğinde sıralama panelinde de paralar anlık değişsin diye sunucuda da parayı tutuyoruz
    socket.on('para-guncelle', (data) => { 
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
            if (oyuncu && data.yeniPara !== undefined) {
                oyuncu.money = data.yeniPara;
            }
            socket.to(oda).emit('para-guncelle-bilgisi', data);
            odayiGuncelle(oda); // Sıralama tablosunu anlık yeniletir
        }
    });

    // BAĞLANTI KOPTIĞINDA LİSTEDEN SİL
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        const oda = socket.currentRoom;
        if (oda && odadakiOyuncular[oda]) {
            // Ayrılan oyuncuyu odadan temizle
            odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);
            odayiGuncelle(oda); // Kalanlara güncel online durumunu bildir
        }
    });
});

// Render veya yerel port için dinamik port kontrolü
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Azgeda Tour ${PORT} portunda başarıyla çalışıyor!`);
});