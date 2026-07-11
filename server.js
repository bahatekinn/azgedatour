const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use('/public', express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const mulkKareleri = [1,2,4,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31];
let festivaller = [];
while(festivaller.length < 3) {
    let rastgele = mulkKareleri[Math.floor(Math.random() * mulkKareleri.length)];
    if(!festivaller.includes(rastgele)) festivaller.push(rastgele);
}

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);
    
    // OYUNCU ODA KODUNU GÖNDERİNCE ÇALIŞACAK
    socket.on('oda-degis', (yeniOda) => {
        socket.join(yeniOda);
        socket.currentRoom = yeniOda; 
        
        // Bağlanan oyuncuya festivalleri gönder
        socket.emit('festival-bilgisi', festivaller);
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

    // MÜLK İŞLEMLERİ
    socket.on('mulk-islem', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('mulk-islem-bilgisi', data);
        }
    });

    // UÇUŞ (DÜNYA TURU)
    socket.on('uctu', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('uctu-bilgisi', data);
        }
    });

    // PARA GÜNCELLEME
    socket.on('para-guncelle', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('para-guncelle-bilgisi', data);
        }
    });
});

http.listen(3000, () => {
    console.log('Azgeda Tour http://localhost:3000 adresinde çalışıyor!');
});