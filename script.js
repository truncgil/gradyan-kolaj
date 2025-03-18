// Uygulama değişkenleri
let uploadedImages = [];
let stage = null;
let layer = null;
let transformer = null;
let stageBorder = null;
let currentStep = 1;
let currentZoom = 100; // Varsayılan yakınlaştırma oranı (%)

// HTML elementlerine erişim
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('preview-container');
const imageCountElement = document.getElementById('image-count');
const canvasContainer = document.getElementById('canvas-container');
const createCollageBtn = document.getElementById('create-collage');
const downloadBtn = document.getElementById('download-collage');
const downloadPngBtn = document.getElementById('download-png');
const canvasWidthInput = document.getElementById('canvas-width');
const canvasHeightInput = document.getElementById('canvas-height');
const backToUploadsBtn = document.getElementById('back-to-uploads');
const moveToolBtn = document.getElementById('move-mode');
const rotateToolBtn = document.getElementById('rotate-mode');
const resizeToolBtn = document.getElementById('resize-mode');
const step1Indicator = document.getElementById('step-1-indicator');
const step2Indicator = document.getElementById('step-2-indicator');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

// Zoom kontrol elementleri
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');
const zoomLevelDisplay = document.getElementById('zoom-level');

// Ön Ayar Butonları
const presetButtons = document.querySelectorAll('.preset-buttons button');

// Olay dinleyicileri
document.addEventListener('DOMContentLoaded', initApp);

// Chrome için genel sürükle-bırak olaylarını engelleyelim
document.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Drop alanının dışındaki sürüklemelerde yasak imleci göster
    if (e.target.id !== 'drop-area' && e.target.parentNode && e.target.parentNode.id !== 'drop-area') {
        e.dataTransfer.effectAllowed = 'none';
        e.dataTransfer.dropEffect = 'none';
    }
    return false;
}, false);

document.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Drop alanının dışındaki sürüklemelerde yasak imleci göster
    if (e.target.id !== 'drop-area' && e.target.parentNode && e.target.parentNode.id !== 'drop-area') {
        e.dataTransfer.effectAllowed = 'none';
        e.dataTransfer.dropEffect = 'none';
    }
    return false;
}, false);

document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}, false);

// Drop alanına özel sürükle-bırak olayları
dropArea.addEventListener('dragenter', handleDragEnter);
dropArea.addEventListener('dragover', handleDragOver);
dropArea.addEventListener('dragleave', handleDragLeave);
dropArea.addEventListener('drop', handleDrop);
dropArea.addEventListener('click', () => fileInput.click());
document.querySelector('.upload-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
createCollageBtn.addEventListener('click', goToCollageEditor);
backToUploadsBtn.addEventListener('click', goToUploadStep);
downloadBtn.addEventListener('click', downloadCollage);
downloadPngBtn.addEventListener('click', downloadPng);

// Editor araç butonları
moveToolBtn.addEventListener('click', () => setActiveTool('move'));
rotateToolBtn.addEventListener('click', () => setActiveTool('rotate'));
resizeToolBtn.addEventListener('click', () => setActiveTool('resize'));

// Preset Butonları
presetButtons.forEach(button => {
    button.addEventListener('click', () => {
        const width = button.getAttribute('data-width');
        const height = button.getAttribute('data-height');
        canvasWidthInput.value = width;
        canvasHeightInput.value = height;
        updateCanvasSize();
    });
});

// Zoom kontrolü olayları
zoomInBtn?.addEventListener('click', () => changeZoom('+'));
zoomOutBtn?.addEventListener('click', () => changeZoom('-'));
zoomResetBtn?.addEventListener('click', () => setZoom(100));

// Fare tekerleği ile zoom
canvasContainer?.addEventListener('wheel', function(e) {
    if (currentStep !== 2) return; // Sadece kolaj adımında çalış
    
    e.preventDefault();
    if (e.deltaY < 0) {
        changeZoom('+');
    } else {
        changeZoom('-');
    }
}, { passive: false });

// Uygulamayı başlat
function initApp() {
    // Konva.js stage oluşturma
    stage = new Konva.Stage({
        container: 'canvas-container',
        width: parseInt(canvasWidthInput.value),
        height: parseInt(canvasHeightInput.value)
    });

    // Layer oluştur
    layer = new Konva.Layer();
    stage.add(layer);
    
    // Tuval sınırlarını ekle
    createStageBorder();
    
    // Transformer oluştur (yeniden boyutlandırma için)
    transformer = new Konva.Transformer({
        nodes: [],
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
        rotateEnabled: true,
        rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
        borderStroke: '#673ab7',
        borderStrokeWidth: 2,
        anchorStroke: '#673ab7',
        anchorFill: '#fff',
        anchorSize: 10,
        rotateAnchorOffset: 30,
        rotateAnchorStroke: '#673ab7',
        rotateAnchorFill: '#fff',
        keepRatio: true,
        centeredScaling: false,
    });
    layer.add(transformer);
    
    // Canvas tıklama dinleyicisi
    stage.on('click tap', function(e) {
        // Boşluğa tıklanırsa transformerı temizle
        if (e.target === stage) {
            transformer.nodes([]);
            layer.draw();
            return;
        }
        
        // Eğer bir grup veya görsel tıklandıysa
        const clickedNode = e.target;
        let targetNode = clickedNode;
        
        // Eğer gruba tıklandıysa veya görsel grup içindeyse, grubu hedef al
        if (clickedNode.parent && clickedNode.parent.hasName('group')) {
            targetNode = clickedNode.parent;
        }
                
        // Hâlihazırda seçili mi kontrol et
        const isSelected = transformer.nodes().indexOf(targetNode) >= 0;
        
        if (!isSelected) {
            // Değilse sadece bu node'u seç
            transformer.nodes([targetNode]);
        }
        
        layer.draw();
    });
    
    // Canvas boyut değişikliği dinleyicileri
    canvasWidthInput.addEventListener('change', updateCanvasSize);
    canvasHeightInput.addEventListener('change', updateCanvasSize);
    
    // Material Design Lite bileşenlerini güncelle
    if (window.componentHandler) {
        componentHandler.upgradeAllRegistered();
    }
}

// Adımlar arası geçiş
function goToCollageEditor() {
    if (uploadedImages.length < 2) {
        showSnackbar('Kolaj oluşturmak için en az 2 görsel gerekli!');
        return;
    }
    
    // Adım göstergesini güncelle
    step1Indicator.classList.remove('active');
    step2Indicator.classList.add('active');
    
    // Adımları göster/gizle
    step1.classList.remove('active');
    step2.classList.add('active');
    
    // Mevcut adımı güncelle
    currentStep = 2;
    
    // Zoom seviyesini sıfırla
    setZoom(100);
    
    // Kolajı oluştur
    createCollage();
}

function goToUploadStep() {
    // Adım göstergesini güncelle
    step1Indicator.classList.add('active');
    step2Indicator.classList.remove('active');
    
    // Adımları göster/gizle
    step1.classList.add('active');
    step2.classList.remove('active');
    
    // Mevcut adımı güncelle
    currentStep = 1;
    
    // Zoom seviyesini sıfırla
    setZoom(100);
}

// Araç modu değiştirme
function setActiveTool(tool) {
    // Tüm butonlardan aktif sınıfını kaldır
    moveToolBtn.classList.remove('tool-active');
    rotateToolBtn.classList.remove('tool-active');
    resizeToolBtn.classList.remove('tool-active');
    
    // Transformer özelliklerini güncelle
    if (tool === 'move') {
        moveToolBtn.classList.add('tool-active');
        transformer.enabledAnchors([]);
        transformer.rotateEnabled(false);
    } else if (tool === 'rotate') {
        rotateToolBtn.classList.add('tool-active');
        transformer.enabledAnchors([]);
        transformer.rotateEnabled(true);
    } else if (tool === 'resize') {
        resizeToolBtn.classList.add('tool-active');
        transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']);
        transformer.rotateEnabled(false);
    }
    
    layer.draw();
}

// Bildirim göster
function showSnackbar(message) {
    if (!document.getElementById('snackbar')) {
        const snackbar = document.createElement('div');
        snackbar.id = 'snackbar';
        snackbar.className = 'mdl-js-snackbar mdl-snackbar';
        snackbar.innerHTML = `
            <div class="mdl-snackbar__text"></div>
            <button class="mdl-snackbar__action" type="button"></button>
        `;
        document.body.appendChild(snackbar);
    }
    
    const snackbarContainer = document.getElementById('snackbar');
    const data = { message: message, timeout: 3000 };
    snackbarContainer.MaterialSnackbar.showSnackbar(data);
}

// Tuval sınırları oluştur
function createStageBorder() {
    // Önceki sınırı kaldır
    if (stageBorder) {
        stageBorder.remove();
    }
    
    // Konva.js container'ını bul
    const konvaContainer = document.querySelector('.konvajs-content');
    if (!konvaContainer) return;
    
    // Sınır div'i oluştur
    stageBorder = document.createElement('div');
    stageBorder.className = 'stage-border';
    
    // Sınır pozisyonunu ve boyutunu ayarla
    stageBorder.style.width = stage.width() + 'px';
    stageBorder.style.height = stage.height() + 'px';
    stageBorder.style.top = '0px';
    stageBorder.style.left = '0px';
    
    // Konva container'ına ekle
    konvaContainer.style.position = 'relative';
    konvaContainer.appendChild(stageBorder);
}

// Canvas boyutunu güncelle
function updateCanvasSize() {
    const width = parseInt(canvasWidthInput.value);
    const height = parseInt(canvasHeightInput.value);
    
    stage.width(width);
    stage.height(height);
    
    // Sınırları güncelle
    if (stageBorder) {
        stageBorder.style.width = width + 'px';
        stageBorder.style.height = height + 'px';
    }
    
    // Kolaj oluşturulduysa tekrar oluştur
    if (uploadedImages.length > 0 && currentStep === 2) {
        createCollage();
    }
}

// Dosya sürüklenmeye başladığında
function handleDragEnter(e) {
    console.log('Drag Enter:', e.type);
    e.preventDefault();
    e.stopPropagation();
    
    // İmleci ayarla
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
    }
    
    dropArea.classList.add('highlight');
}

// Dosya sürüklendiğinde
function handleDragOver(e) {
    console.log('Drag Over:', e.type);
    e.preventDefault();
    e.stopPropagation();
    
    // İmleci ayarla
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.dropEffect = 'copy';
    }
    
    dropArea.classList.add('highlight');
    return false;
}

// Dosya sürüklemesi bittiğinde
function handleDragLeave(e) {
    console.log('Drag Leave:', e.type);
    e.preventDefault();
    e.stopPropagation();
    // Gerçekten alanın dışına çıkıldığını kontrol et
    const rect = dropArea.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // Fare gerçekten alanın dışındaysa sınıfı kaldır
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        dropArea.classList.remove('highlight');
    }
}

// Dosya bırakıldığında
function handleDrop(e) {
    console.log('Drop Event:', e.type, e.dataTransfer);
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('highlight');
    
    let fileList = [];
    
    // Chrome, Firefox ve diğer modern tarayıcılar için
    if (e.dataTransfer.items) {
        console.log('Using dataTransfer.items - length:', e.dataTransfer.items.length);
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
            console.log('Item type:', e.dataTransfer.items[i].kind, e.dataTransfer.items[i].type);
            if (e.dataTransfer.items[i].kind === 'file') {
                const file = e.dataTransfer.items[i].getAsFile();
                console.log('Got file:', file ? file.name : 'null');
                if (file) {
                    fileList.push(file);
                }
            }
        }
    } else if (e.dataTransfer.files) {
        // Safari ve eski tarayıcılar için
        console.log('Using dataTransfer.files - length:', e.dataTransfer.files.length);
        fileList = Array.from(e.dataTransfer.files);
    }
    
    console.log('Final file list:', fileList.length);
    if (fileList && fileList.length > 0) {
        processFiles(fileList);
    } else {
        showSnackbar('Dosya bırakılamadı. Lütfen dosya seçerek deneyin.');
    }
}

// Dosya seçildiğinde
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length) {
        processFiles(files);
    }
}

// Dosyaları işle
function processFiles(files) {
    // Sadece görsel dosyalarını filtrele
    const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showSnackbar('Lütfen geçerli görsel dosyaları seçin (jpg, png, gif vb.)');
        return;
    }
    
    // Tüm görselleri işle
    const promises = imageFiles.map(file => loadImage(file));
    
    Promise.all(promises)
        .then(images => {
            uploadedImages = uploadedImages.concat(images);
            updateImagePreview();
            createCollageBtn.disabled = uploadedImages.length < 2;
            
            // Görsel sayısı bildirimi
            if (images.length === 1) {
                showSnackbar('1 görsel yüklendi');
            } else {
                showSnackbar(`${images.length} görsel yüklendi`);
            }
        })
        .catch(error => {
            console.error('Görsel yükleme hatası:', error);
            showSnackbar('Görseller yüklenirken bir hata oluştu.');
        });
}

// Görseli yükle
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = function() {
                resolve({
                    element: img,
                    src: e.target.result,
                    width: img.width,
                    height: img.height,
                    file: file
                });
            };
            
            img.onerror = function() {
                reject(new Error(`Görsel yüklenemedi: ${file.name}`));
            };
        };
        
        reader.onerror = function() {
            reject(new Error(`Dosya okunamadı: ${file.name}`));
        };
        
        reader.readAsDataURL(file);
    });
}

// Görsel önizlemelerini güncelle
function updateImagePreview() {
    previewContainer.innerHTML = '';
    
    uploadedImages.forEach((image, index) => {
        const preview = document.createElement('img');
        preview.src = image.src;
        preview.className = 'preview-image';
        preview.title = image.file.name;
        
        // Görseli kaldırma özelliği
        preview.addEventListener('click', () => {
            uploadedImages.splice(index, 1);
            updateImagePreview();
            createCollageBtn.disabled = uploadedImages.length < 2;
            
            // Görsel sayacını güncelle
            imageCountElement.textContent = `(${uploadedImages.length})`;
            
            showSnackbar('Görsel kaldırıldı');
        });
        
        previewContainer.appendChild(preview);
    });
    
    // Görsel sayacını güncelle
    imageCountElement.textContent = `(${uploadedImages.length})`;
}

// Kolaj oluştur
function createCollage() {
    if (uploadedImages.length < 2) {
        showSnackbar('Kolaj oluşturmak için en az 2 görsel gereklidir.');
        return;
    }
    
    // Stage'i temizle
    layer.destroyChildren();
    transformer = new Konva.Transformer({
        nodes: [],
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
        rotateEnabled: true,
        rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
        borderStroke: '#673ab7',
        borderStrokeWidth: 2,
        anchorStroke: '#673ab7',
        anchorFill: '#fff',
        anchorSize: 10,
        rotateAnchorOffset: 30,
        rotateAnchorStroke: '#673ab7',
        rotateAnchorFill: '#fff',
        keepRatio: true,
        centeredScaling: false,
    });
    layer.add(transformer);
    
    const width = stage.width();
    const height = stage.height();
    
    // Görsel sayısına göre pozisyonları hesapla
    const imageCount = uploadedImages.length;
    const gradientSteps = imageCount - 1;
    
    // Her bir görsel için
    uploadedImages.forEach((image, index) => {
        const normalizedIndex = index / gradientSteps;
        
        // Görsel pozisyonu ve boyutu için hesaplamalar
        // Her görsel bir öncekiyle çakışacak şekilde yerleştirilir
        const x = Math.floor(normalizedIndex * (width * 0.7));
        const y = Math.floor(normalizedIndex * (height * 0.3));
        
        // Orantılı boyut hesaplama
        const aspectRatio = image.width / image.height;
        let imgWidth = width / (imageCount) * 1.8;  // Örtüşme için fazladan boyut
        let imgHeight = imgWidth / aspectRatio;
        
        // Küçük görselleri orantılı büyüt
        if (imgWidth < width / 3) {
            imgWidth = width / 3;
            imgHeight = imgWidth / aspectRatio;
        }
        
        // Her görselin boyutunu maksimum yüksekliğe göre sınırla
        if (imgHeight > height * 0.9) {
            imgHeight = height * 0.9;
            imgWidth = imgHeight * aspectRatio;
        }
        
        // İlk görsel için gradyan opaklık uygula
        if (index === 0 && imageCount > 1) {
            // Konva Image nesnesi oluştur
            const konvaImage = new Konva.Image({
                x: x,
                y: y,
                image: image.element,
                width: imgWidth,
                height: imgHeight,
                opacity: 1,
                draggable: true,
                name: 'image',
            });
            
            // Sağ tarafta gradyan geçiş maskeleme yerine canvas ile yapma
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = imgHeight;
            const ctx = canvas.getContext('2d');
            
            // Görsel çiz
            ctx.drawImage(image.element, 0, 0, imgWidth, imgHeight);
            
            // Sağ taraf gradyan opaklık uygula
            const gradient = ctx.createLinearGradient(0, 0, imgWidth, 0);
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); // Tamamen transparan
            gradient.addColorStop(0.7, 'rgba(0,0,0,0)'); // Tamamen transparan
            gradient.addColorStop(1, 'rgba(0,0,0,1)'); // Tamamen opak (siyah)
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, imgWidth, imgHeight);
            
            const gradientImage = new Image();
            gradientImage.src = canvas.toDataURL();
            
            gradientImage.onload = function() {
                const group = new Konva.Group({
                    x: x,
                    y: y,
                    draggable: true,
                    name: 'group',
                });
                
                const finalImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: gradientImage,
                    width: imgWidth,
                    height: imgHeight,
                    name: 'image',
                });
                
                group.add(finalImage);
                layer.add(group);
                layer.draw();
                
                // Son eklenen elemanların üstte olması için z-indeksini düzenle
                group.moveToTop();
                transformer.moveToTop();
            };
        } 
        // Orta görseller için iki taraflı gradyan uygula
        else if (index > 0 && index < imageCount - 1) {
            // Canvas kullanarak gradyan uygula
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = imgHeight;
            const ctx = canvas.getContext('2d');
            
            // Görsel çiz
            ctx.drawImage(image.element, 0, 0, imgWidth, imgHeight);
            
            // İki taraflı gradyan opaklık uygula
            const gradient = ctx.createLinearGradient(0, 0, imgWidth, 0);
            gradient.addColorStop(0, 'rgba(0,0,0,1)'); // Tamamen opak (siyah) - sol kenar
            gradient.addColorStop(0.3, 'rgba(0,0,0,0)'); // Transparan - sol taraftan sonra
            gradient.addColorStop(0.7, 'rgba(0,0,0,0)'); // Transparan - sağ tarafa kadar
            gradient.addColorStop(1, 'rgba(0,0,0,1)'); // Tamamen opak (siyah) - sağ kenar
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, imgWidth, imgHeight);
            
            const gradientImage = new Image();
            gradientImage.src = canvas.toDataURL();
            
            gradientImage.onload = function() {
                const group = new Konva.Group({
                    x: x,
                    y: y,
                    draggable: true,
                    name: 'group',
                });
                
                const finalImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: gradientImage,
                    width: imgWidth,
                    height: imgHeight,
                    name: 'image',
                });
                
                group.add(finalImage);
                layer.add(group);
                layer.draw();
                
                // Son eklenen elemanların üstte olması için z-indeksini düzenle
                group.moveToTop();
                transformer.moveToTop();
            };
        }
        // Son görsel için sol taraf gradyan
        else if (index === imageCount - 1 && index > 0) {
            // Canvas kullanarak gradyan uygula
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = imgHeight;
            const ctx = canvas.getContext('2d');
            
            // Görsel çiz
            ctx.drawImage(image.element, 0, 0, imgWidth, imgHeight);
            
            // Sol tarafta gradyan opaklık uygula
            const gradient = ctx.createLinearGradient(0, 0, imgWidth, 0);
            gradient.addColorStop(0, 'rgba(0,0,0,1)'); // Tamamen opak (siyah) - sol kenar
            gradient.addColorStop(0.3, 'rgba(0,0,0,0)'); // Transparan - sol taraftan sonra
            gradient.addColorStop(1, 'rgba(0,0,0,0)'); // Tamamen transparan - sağ kenar
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, imgWidth, imgHeight);
            
            const gradientImage = new Image();
            gradientImage.src = canvas.toDataURL();
            
            gradientImage.onload = function() {
                const group = new Konva.Group({
                    x: x,
                    y: y,
                    draggable: true,
                    name: 'group',
                });
                
                const finalImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: gradientImage,
                    width: imgWidth,
                    height: imgHeight,
                    name: 'image',
                });
                
                group.add(finalImage);
                layer.add(group);
                layer.draw();
                
                // Son eklenen elemanların üstte olması için z-indeksini düzenle
                group.moveToTop();
                transformer.moveToTop();
            };
        }
        // Tek görsel varsa normal ekle
        else {
            const konvaImage = new Konva.Image({
                x: x,
                y: y,
                image: image.element,
                width: imgWidth,
                height: imgHeight,
                opacity: 1,
                draggable: true,
                name: 'image',
            });
            layer.add(konvaImage);
            
            // Son eklenen elemanların üstte olması için z-indeksini düzenle
            konvaImage.moveToTop();
            transformer.moveToTop();
        }
    });
    
    layer.draw();
    downloadBtn.disabled = false;
    downloadPngBtn.disabled = false;
    
    // Kolaj oluşturulduktan sonra ilk nesneyi seç
    setTimeout(() => {
        const nodes = layer.children.filter(child => child.hasName('group') || child.hasName('image'));
        if (nodes.length > 0) {
            transformer.nodes([nodes[0]]);
            layer.draw();
        }
    }, 500); // Görseller yüklendikten sonra çalışması için biraz bekle
    
    // Bildirim göster
    showSnackbar('Kolaj oluşturuldu! Görselleri düzenleyebilirsiniz.');
}

// Kolajı JPG olarak indir
function downloadCollage() {
    // Dönüştürücü görünürlüğünü geçici olarak kapat
    const originalVisibility = transformer.visible();
    transformer.visible(false);
    layer.draw();
    
    // Kısa bir gecikmeden sonra ekran görüntüsü al (çizimin güncellenmesi için)
    setTimeout(() => {
        const dataURL = stage.toDataURL({ 
            pixelRatio: 2,
            mimeType: 'image/jpeg',
            quality: 0.95
        });
        
        const link = document.createElement('a');
        link.download = 'gradyan-kolaj.jpg';
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Dönüştürücü görünürlüğünü eski haline getir
        transformer.visible(originalVisibility);
        layer.draw();
        
        showSnackbar('Kolaj JPG olarak indirildi!');
    }, 50);
}

// Kolajı PNG olarak indir (transparan)
function downloadPng() {
    // Dönüştürücü görünürlüğünü geçici olarak kapat
    const originalVisibility = transformer.visible();
    transformer.visible(false);
    layer.draw();
    
    // Kısa bir gecikmeden sonra ekran görüntüsü al (çizimin güncellenmesi için)
    setTimeout(() => {
        const dataURL = stage.toDataURL({ 
            pixelRatio: 2,
            mimeType: 'image/png'
        });
        
        const link = document.createElement('a');
        link.download = 'gradyan-kolaj.png';
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Dönüştürücü görünürlüğünü eski haline getir
        transformer.visible(originalVisibility);
        layer.draw();
        
        showSnackbar('Kolaj PNG olarak indirildi!');
    }, 50);
}

// Zoom seviyesini değiştir
function changeZoom(direction) {
    const zoomLevels = [50, 75, 100, 125, 150, 200];
    let currentIndex = zoomLevels.indexOf(currentZoom);
    
    if (currentIndex === -1) {
        // Eğer mevcut değer listede yoksa, en yakın değeri bul
        currentIndex = 2; // Varsayılan olarak 100% (2. index)
    }
    
    if (direction === '+' && currentIndex < zoomLevels.length - 1) {
        currentIndex++;
    } else if (direction === '-' && currentIndex > 0) {
        currentIndex--;
    }
    
    setZoom(zoomLevels[currentIndex]);
}

// Yakınlaştırma seviyesini ayarla
function setZoom(zoomLevel) {
    currentZoom = zoomLevel;
    
    // Tüm zoom sınıflarını kaldır
    canvasContainer.classList.remove('zoom-50', 'zoom-75', 'zoom-100', 'zoom-125', 'zoom-150', 'zoom-200');
    
    // Yeni zoom sınıfını ekle
    canvasContainer.classList.add(`zoom-${zoomLevel}`);
    
    // Göstergeyi güncelle
    zoomLevelDisplay.textContent = `${zoomLevel}%`;
} 