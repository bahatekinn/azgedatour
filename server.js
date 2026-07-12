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



// Sırayı bir sonraki oyuncuya geçiren yardımcı fonksiyon

function sirayiDegistir(odaKodu) {

    let oda = odadakiOyuncular[odaKodu];

    if (!oda || oda.length === 0) return;



    let currentIndex = oda.findIndex(o => o.id === oda.aktifSiraId);

    let nextIndex = (currentIndex + 1) % oda.length;

   

    oda.aktifSiraId = oda[nextIndex].id;

    oda.zarAttiMi = false; // Yeni oyuncu için zar atma hakkını sıfırla



    io.to(odaKodu).emit('sira-guncelle', { aktifSiraId: oda.aktifSiraId });

}



io.on('connection', (socket) => {

    console.log('Bir oyuncu bağlandı! ID:', socket.id);

   

    // 1. ODA DEĞİŞTİRME / ODAYA GİRİŞ (Her şeyden önce bu çalışmalı)

    socket.on('oda-degis', (yeniOda) => {

        // Eğer zaten bir odadaysa önce eski odadan çıkış yapsın

        if(socket.currentRoom) {

            socket.leave(socket.currentRoom);

            if (odadakiOyuncular[socket.currentRoom]) {

                let eskiOda = socket.currentRoom;

                odadakiOyuncular[eskiOda] = odadakiOyuncular[eskiOda].filter(o => o.id !== socket.id);

               

                // Eğer sıradaki oyuncu odadan çıktıysa sırayı hemen başkasına devret

                if (odadakiOyuncular[eskiOda].aktifSiraId === socket.id) {

                    sirayiDegistir(eskiOda);

                }

                odayiGuncelle(eskiOda);

            }

        }



        socket.join(yeniOda);

        socket.currentRoom = yeniOda;

        socket.emit('festival-bilgisi', festivaller);

       

        // Eğer odada daha önce ilan edilmiş bir Dünya Şampiyonası şehri varsa yeni gelen oyuncuya da bildir

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

            odadakiOyuncular[oda].dunyaSampiyonasiSehirId = null; // Oda bazlı şampiyona takibi

        }

       

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

    });



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

            // Güvenlik Kontrolü: Sıra bu oyuncuda mı ve bu tur zaten zar attı mı?

            if (odadakiOyuncular[oda].aktifSiraId !== socket.id || odadakiOyuncular[oda].zarAttiMi) {

                return; // Sırası olmayan veya mükerrer basan oyuncunun isteğini reddet

            }



            odadakiOyuncular[oda].zarAttiMi = true; // Oyuncu zar hakkını kullandı



            // --- STRATEJİK AĞIRLIKLI ZAR MOTORU ---

            // Havuzda 100 adet eleman var.

            // 10 adet 6 (%10 ihtimal)

            // 25 adet 5 (%25 ihtimal)

            // Geriye kalan 65 slot ise 1, 2, 3 ve 4 sayılarına dengeli dağıtıldı.

            const zarHavuzu = [

                6,6,6,6,6,6,6,6,6,6,

                5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,

                1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,

                2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,

                3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,

                4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4

            ];



            // Havuzun içerisinden tamamen rastgele birer sayı seçtiriyoruz

            const zar1 = zarHavuzu[Math.floor(Math.random() * zarHavuzu.length)];

            const zar2 = zarHavuzu[Math.floor(Math.random() * zarHavuzu.length)];

            const cift = (zar1 === zar2);

           

            io.to(oda).emit('zar-sonucu', {

                oyuncuId: socket.id,

                deger: zar1 + zar2,

                zar1: zar1,

                zar2: zar2,

                cift: cift

            });



            // Eğer çift zar GEKMEDİYSE piyon yürüme animasyonundan sonra (yaklaşık 2.5 saniye) sırayı devret

            if (!cift) {

                setTimeout(() => {

                    sirayiDegistir(oda);

                }, 2500);

            } else {

                // Çift zar geldiyse oyuncunun aynı tur içinde tekrar zar atabilmesi için kilidi aç

                odadakiOyuncular[oda].zarAttiMi = false;

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
        // Diğer oyunculara kimin parasının değiştiğini bildiriyoruz
        socket.to(oda).emit('para-guncelle-bilgisi', { id: socket.id, yeniPara: data.yeniPara });
        odayiGuncelle(oda); 
    }
});
// 3. OYUNCU HAREKET ETTİĞİNDE POZİSYONU GÜNCELLE




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

});



// Render veya yerel port için dinamik port kontrolü

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {

    console.log(`Azgeda Tour ${PORT} portunda başarıyla çalışıyor!`);

});  

