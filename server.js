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
io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı! ID:', socket.id);});


// 1. ODA DEĞİŞTİRME / ODAYA GİRİŞ
    socket.on('oda-degis', (yeniOda) => {
        if(socket.currentRoom) {
            socket.leave(socket.currentRoom);
            if (odadakiOyuncular[socket.currentRoom]) {
                let eskiOda = socket.currentRoom;
                odadakiOyuncular[eskiOda] = odadakiOyuncular[eskiOda].filter(o => o.id !== socket.id);
                if (odadakiOyuncular[eskiOda].aktifSiraId === socket.id) {
                    sirayiDegistir(eskiOda);
                }
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

    // 2. OYUNCU BİLGİLERİYLE KATILDIĞINDA
    socket.on('yeni-oyuncu-katildi', (data) => {
        const oda = socket.currentRoom || "genel";
        if (!odadakiOyuncular[oda]) {
            odadakiOyuncular[oda] = [];
            odadakiOyuncular[oda].aktifSiraId = null;
            odadakiOyuncular[oda].zarAttiMi = false;
            odadakiOyuncular[oda].dunyaSampiyonasiSehirId = null;
        }
        
        odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);
        let oyuncuBilgisi = {
            id: socket.id,
            nick: data.nick || `Oyuncu_${Math.floor(Math.random()*100)}`,
            avatar: data.avatar,
            pos: 0,
            money: 2000000 
        };
        
        odadakiOyuncular[oda].push(oyuncuBilgisi);
        
        if (!odadakiOyuncular[oda].aktifSiraId) {
            odadakiOyuncular[oda].aktifSiraId = socket.id;
        }
        
        socket.to(oda).emit('oyuncu-listesini-guncelle', oyuncuBilgisi);
        socket.emit('mevcut-oyuncular', odadakiOyuncular[oda]);
        io.to(oda).emit('sira-guncelle', { aktifSiraId: odadakiOyuncular[oda].aktifSiraId });
        odayiGuncelle(oda);
    });

    // 2. OYUNCU BİLGİLERİYLE KATILDIĞINDA



       

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

       

        // Eğer odada aktif bir sıra yoksa (ilk giren oyuncuysa) sırayı ona ver

        if (!odadakiOyuncular[oda].aktifSiraId) {

            odadakiOyuncular[oda].aktifSiraId = socket.id;

        }

       

        // Odadaki diğer arkadaşlarına yeni birinin geldiğini bildir

        socket.to(oda).emit('oyuncu-listesini-guncelle', oyuncuBilgisi);

       

        // Kendisine odada halihazırda bekleyen oyuncuları gönder

        socket.emit('mevcut-oyuncular', odadakiOyuncular[oda]);



        // Herkese güncel sıra bilgisini fırlat

        io.to(oda).emit('sira-guncelle', { aktifSiraId: odadakiOyuncular[oda].aktifSiraId });



        // Herkese güncel online listesini fırlat (Böylece panellerde anlık gözükeceksiniz)

        odayiGuncelle(oda);

    ;



    // 3. OYUNCU HAREKET ETTİĞİNDE POZİSYONU GÜNCELLE

   // 3. OYUNCU HAREKET ETTİĞİNDE POZİSYONU GÜNCELLE
socket.on('piyon-hareket-etti', (data) => {
    const oda = socket.currentRoom;
    if (oda && odadakiOyuncular[oda]) {
        let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
        
        if (oyuncu) {
            // Oyuncunun pozisyonunu sunucu tarafında da güncelliyoruz
            oyuncu.pos = data.yeniPos;
            
            // Hareket bilgisini odadaki TÜM oyunculara (kendisi dahil) iletiyoruz.
            // Bu sayede diğer oyuncuların ekranında piyonun yeri anlık güncellenir.
            io.to(oda).emit('tum-oyuncular-guncellendi', odadakiOyuncular[oda]);
            
            // Eğer piyon yeni bir kareye girdiyse, burada ekstra sunucu taraflı 
            // kontrol (örneğin mülk satın alma durumu) yapman gerekirse 
            // bu blok içinde tetikleyebilirsin.
        }
    }
});



    // SOHBET (Odaya özel)

    socket.on('mesaj-yolla', (data) => {

        if (socket.currentRoom) io.to(socket.currentRoom).emit('mesaj-al', data);

    });



    // ZAR (Sıra tabanlı ve Ağırlıklandırılmış Özel Zar Olasılığı)

   socket.on('zar-at', () => {
    const oda = socket.currentRoom;
    if (oda && odadakiOyuncular[oda]) {
        // GÜVENLİK KONTROLÜ: 
        // 1. Sıra bu oyuncuda mı?
        // 2. Bu oyuncu bu tur zaten zar attı mı? (Çift zar değilse)
        if (odadakiOyuncular[oda].aktifSiraId !== socket.id || odadakiOyuncular[oda].zarAttiMi) {
            return; // Yetkisiz veya mükerrer zar isteğini reddet
        }

        // Oyuncu zar hakkını hemen kilitle
        odadakiOyuncular[oda].zarAttiMi = true; 

        // --- STRATEJİK AĞIRLIKLI ZAR MOTORU ---
        const zarHavuzu = [
            6,6,6,6,6,6,6,6,6,6,
            5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
            1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
            2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,
            3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,
            4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4
        ];

        const zar1 = zarHavuzu[Math.floor(Math.random() * zarHavuzu.length)];
        const zar2 = zarHavuzu[Math.floor(Math.random() * zarHavuzu.length)];
        const cift = (zar1 === zar2);
        
        // Zar sonucunu herkesle paylaş
        io.to(oda).emit('zar-sonucu', {
            oyuncuId: socket.id,
            deger: zar1 + zar2,
            zar1: zar1,
            zar2: zar2,
            cift: cift
        });

        // Çift zar gelmediyse sıra geçişi başlat
        if (!cift) {
            setTimeout(() => {
                sirayiDegistir(oda);
            }, 2500); // Animasyon süresine göre ayarlandı
        } else {
            // Çift zar geldiyse, 1 saniye sonra zar hakkını geri ver (tekrar atabilsin diye)
            setTimeout(() => {
                if (odadakiOyuncular[oda]) {
                    odadakiOyuncular[oda].zarAttiMi = false;
                }
            }, 1000);
        }
    }
});

    // DÜNYA ŞAMPİYONASI (Seçilen mülkü sunucu hafızasına kaydeder ve odadaki herkese fırlatır)

    socket.on('sampiyona-ilan-et', (data) => {

        const oda = socket.currentRoom;

        if (oda && odadakiOyuncular[oda]) {

            // Şampiyona mülk ID bilgisini odanın durum hafızasına kalıcı alıyoruz kanka

            odadakiOyuncular[oda].dunyaSampiyonasiSehirId = data.sehirId;

            // Odadaki diğer oyuncuların ekranında da kupa emojisi anlık tetiklensin diye yayınlıyoruz

            socket.to(oda).emit('sampiyona-guncelle', { sehirId: data.sehirId });

        }

    });



    // MÜLK, UÇUŞ VE PARA GÜNCELLEMELERİ

    // MÜLK, UÇUŞ VE PARA GÜNCELLEMELERİ
socket.on('mulk-islem', (data) => {
    if (socket.currentRoom) {
        // 1. İşlem bilgisini gönder (Animasyonlar vb. için)
        socket.to(socket.currentRoom).emit('mulk-islem-bilgisi', data);
        
        // 2. ÖNEMLİ: Odadaki tüm oyuncuların güncel durumunu herkese tekrar yolla!
        // Bu sayede herkesin ekranında mülkler ve para durumu SIFIRLANIR ve eşleşir.
        io.to(socket.currentRoom).emit('tum-oyuncular-guncellendi', odadakiOyuncular[socket.currentRoom]);
    }
});

    socket.on('uctu', (data) => { if (socket.currentRoom) socket.to(socket.currentRoom).emit('uctu-bilgisi', data); });

   

    // Para güncellendiğinde sıralama panelinde de paralar anlık değişsin diye sunucuda da parayı tutuyoruz
    socket.on('para-guncelle', (data) => {
    const oda = socket.currentRoom;
    if (oda && odadakiOyuncular[oda]) {
        let oyuncu = odadakiOyuncular[oda].find(o => o.id === socket.id);
        if (oyuncu && data.yeniPara !== undefined) {
            oyuncu.money = data.yeniPara;
        }
        // Diğer oyunculara kimin parasının değiştiğini bildiriyoruz
        socket.to(oda).emit('para-guncelle-bilgisi', { id: socket.id, yeniPara: data.yeniPara });
        odayiGuncelle(oda); 
    }
});
// 3. OYUNCU HAREKET ETTİĞİNDE POZİSYONU GÜNCELLE
// --- TAKAS SİSTEMİ EKLENTİSİ ---
    socket.on('takas-teklifi-gonder', (data) => {
        socket.to(data.aliciId).emit('takas-teklifi-al', data);
    });

    socket.on('takas-cevabi-ver', (data) => {
        socket.to(data.gonderenId).emit('takas-sonuc-bilgisi', data);
    });



    // BAĞLANTI KOPTIĞINDA LİSTEDEN SİL

    socket.on('disconnect', () => {

        console.log('Oyuncu ayrıldı:', socket.id);

        const oda = socket.currentRoom;

        if (oda && odadakiOyuncular[oda]) {

            // Eğer ayrılan kişi şu an oyun sırasına sahipse sırayı başkasına geçir

            if (odadakiOyuncular[oda].aktifSiraId === socket.id) {

                sirayiDegistir(oda);

            }

           

            // Ayrılan oyuncuyu odadan temizle

            odadakiOyuncular[oda] = odadakiOyuncular[oda].filter(o => o.id !== socket.id);

            odayiGuncelle(oda); // Kalanlara güncel online durumunu bildir

        }

    });

;



// Render veya yerel port için dinamik port kontrolü

socket.on('disconnect', () => {
        // ... (kodların)
        odayiGuncelle(oda); 
    });
; // <--- BU PARANTEZ EKSİKTİ! Bu, 90. satırdaki 'io.on'u kapatır.

// Render veya yerel port için dinamik port kontrolü
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Azgeda Tour ${PORT} portunda başarıyla çalışıyor!`);
});