const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');
const htmlToDocx = require('html-to-docx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const tesseract = require('tesseract.js');
const sharp = require('sharp');
const odt2html = require('odt2html');
require('dotenv').config();

const app = express();

// إعداد المجلدات
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir('uploads');
ensureDir('exports');
ensureDir('temp');

// إعداد multer لرفع الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.oasis.opendocument.text',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/plain'
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.odt', '.jpg', '.jpeg', '.png', '.txt'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: [
    'https://your-app.netlify.app', // استبدل برابط netlify الفعلي
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// متغير لحفظ السجل
let textHistory = [];

// وظائف استخراج النص من الملفات
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return pdfData.text;
  } catch (error) {
    throw new Error('فشل في استخراج النص من PDF');
  }
}

async function extractTextFromDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    throw new Error('فشل في استخراج النص من ملف Word');
  }
}

async function extractTextFromODT(filePath) {
  return new Promise((resolve, reject) => {
    odt2html(filePath, (err, text) => {
      if (err) {
        reject(new Error('فشل في استخراج النص من ملف ODT'));
      } else {
        const cleanText = text
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        resolve(cleanText);
      }
    });
  });
}

async function extractTextFromImage(filePath) {
  try {
    const processedImage = await sharp(filePath)
      .resize(2000)
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer();

    const { data: { text } } = await tesseract.recognize(processedImage, 'ara', {
      logger: m => console.log(m)
    });
    
    return text;
  } catch (error) {
    throw new Error('فشل في استخراج النص من الصورة');
  }
}

async function extractTextFromFile(filePath, mimetype) {
  try {
    let text = '';
    
    switch (mimetype) {
      case 'application/pdf':
        text = await extractTextFromPDF(filePath);
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        text = await extractTextFromDOCX(filePath);
        break;
      case 'application/vnd.oasis.opendocument.text':
        text = await extractTextFromODT(filePath);
        break;
      case 'image/jpeg':
      case 'image/png':
      case 'image/jpg':
        text = await extractTextFromImage(filePath);
        break;
      case 'text/plain':
        text = fs.readFileSync(filePath, 'utf8');
        break;
      default:
        const fileExtension = path.extname(filePath).toLowerCase();
        if (fileExtension === '.odt') {
          text = await extractTextFromODT(filePath);
        } else {
          throw new Error('نوع الملف غير مدعوم');
        }
    }
    
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    throw error;
  }
}

// نقطة النهاية الرئيسية لتشكيل النصوص
app.post('/api/tashkeel', async (req, res) => {
  try {
    const { text, options = {} } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'الرجاء إدخال نص لتشكيله' 
      });
    }

    console.log('تشكيل النص:', text.substring(0, 50) + '...');

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `أنت خبير في اللغة العربية والتشكيل. قم بتشكيل النص العربي بشكل دقيق مع الحفاظ على المعنى.
            
            التعليمات:
            1. شكل كل الكلمات بشكل صحيح
            2. حافظ على تنسيق النص الأصلي
            3. لا تضيف أي تعليقات إضافية
            4. أعد النص المشكول فقط دون أي إضافات
            5. تأكد من دقة التشكيل النحوي`
          },
          {
            role: 'user',
            content: `قم بتشكيل هذا النص العربي تشكيلاً كاملاً وصحيحاً:

            ${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const shapedText = response.data.choices[0].message.content.trim();
    
    const historyItem = {
      id: Date.now(),
      type: 'tashkeel',
      original: text,
      shaped: shapedText,
      date: new Date().toLocaleString('ar-SA'),
      timestamp: new Date()
    };
    
    textHistory.unshift(historyItem);
    textHistory = textHistory.slice(0, 50);

    res.json({ 
      success: true, 
      result: shapedText,
      historyId: historyItem.id
    });
    
  } catch (error) {
    console.error('خطأ في التشكيل:', error.response?.data || error.message);
    
    let errorMessage = 'فشل في تشكيل النص';
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'لا يمكن الاتصال بالخادم';
    } else if (error.response?.status === 401) {
      errorMessage = 'مفتاح API غير صالح';
    } else if (error.response?.status === 429) {
      errorMessage = 'تم تجاوز الحد المسموح لطلبات API';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

// نقطة النهاية لتصحيح الأخطاء اللغوية والنحوية
app.post('/api/correct-text', async (req, res) => {
  try {
    const { text, correctionType = 'all' } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'الرجاء إدخال نص لتصحيحه' 
      });
    }

    console.log('تصحيح النص:', text.substring(0, 50) + '...', 'النوع:', correctionType);

    let systemPrompt = '';
    switch (correctionType) {
      case 'spelling':
        systemPrompt = `أنت خبير في اللغة العربية متخصص في تصحيح الأخطاء الإملائية فقط.
        
        التعليمات الصارمة:
        1. ركز فقط على الأخطاء الإملائية (هجاء الكلمات)
        2. لا تقم بتغيير التراكيب النحوية
        3. حافظ على المعنى الأصلي تماماً
        4. أعد النص المصحح إملائياً فقط
        5. لا تضيف أي شروحات أو تعليقات`;
        break;
        
      case 'grammar':
        systemPrompt = `أنت خبير في اللغة العربية متخصص في تصحيح الأخطاء النحوية فقط.
        
        التعليمات الصارمة:
        1. ركز فقط على الأخطاء النحوية (الإعراب والتراكيب)
        2. لا تقم بتغيير الهجاء الإملائي
        3. حافظ على المعنى الأصلي تماماً
        4. أعد النص المصحح نحوياً فقط
        5. لا تضيف أي شروحات أو تعليقات`;
        break;
        
      case 'all':
      default:
        systemPrompt = `أنت خبير في اللغة العربية متخصص في تصحيح الأخطاء اللغوية الشاملة.
        
        التعليمات الصارمة:
        1. صحح الأخطاء الإملائية والنحوية معاً
        2. حافظ على المعنى الأصلي تماماً
        3. أعد النص المصحح كاملاً
        4. لا تضيف أي شروحات أو تعليقات
        5. ركز على الدقة اللغوية`;
    }

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `قم بتصحيح هذا النص العربي حسب التعليمات بدقة:

${text}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const correctedText = response.data.choices[0].message.content.trim();
    const cleanCorrectedText = correctedText.split('\n')[0];

    const historyItem = {
      id: Date.now(),
      type: 'correction',
      correctionType: correctionType,
      original: text,
      corrected: cleanCorrectedText,
      date: new Date().toLocaleString('ar-SA'),
      timestamp: new Date()
    };

    textHistory.unshift(historyItem);
    textHistory = textHistory.slice(0, 50);

    res.json({ 
      success: true, 
      correctedText: cleanCorrectedText,
      originalText: text,
      correctionType: correctionType,
      historyId: historyItem.id
    });
    
  } catch (error) {
    console.error('خطأ في التصحيح:', error.response?.data || error.message);
    
    let errorMessage = 'فشل في تصحيح النص';
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'لا يمكن الاتصال بالخادم';
    } else if (error.response?.status === 401) {
      errorMessage = 'مفتاح API غير صالح';
    } else if (error.response?.status === 429) {
      errorMessage = 'تم تجاوز الحد المسموح لطلبات API';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

// نقطة النهاية المدمجة (تشكيل وتصحيح)
app.post('/api/tashkeel-and-correct', async (req, res) => {
  try {
    const { text, options = {} } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'الرجاء إدخال نص لمعالجته' 
      });
    }

    console.log('معالجة النص (تشكيل وتصحيح):', text.substring(0, 50) + '...');

    // أولاً: تصحيح النص
    const correctionResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `أنت خبير في اللغة العربية متخصص في تصحيح الأخطاء اللغوية والنحوية.
            
            التعليمات:
            1. قم بتصحيح الأخطاء الإملائية والنحوية
            2. حافظ على المعنى الأصلي
            3. أعد النص المصحح فقط`
          },
          {
            role: 'user',
            content: `قم بتصحيح هذا النص العربي:

            ${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const correctedText = correctionResponse.data.choices[0].message.content.trim();

    // ثانياً: تشكيل النص المصحح
    const tashkeelResponse = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `أنت خبير في اللغة العربية والتشكيل. قم بتشكيل النص العربي بشكل دقيق.
            
            التعليمات:
            1. شكل كل الكلمات بشكل صحيح
            2. حافظ على تنسيق النص الأصلي
            3. لا تضيف أي تعليقات إضافية
            4. أعد النص المشكول فقط`
          },
          {
            role: 'user',
            content: `قم بتشكيل هذا النص العربي تشكيلاً كاملاً وصحيحاً:

            ${correctedText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const shapedText = tashkeelResponse.data.choices[0].message.content.trim();

    const historyItem = {
      id: Date.now(),
      type: 'tashkeel_and_correct',
      original: text,
      corrected: correctedText,
      shaped: shapedText,
      date: new Date().toLocaleString('ar-SA'),
      timestamp: new Date()
    };

    textHistory.unshift(historyItem);
    textHistory = textHistory.slice(0, 50);

    res.json({ 
      success: true, 
      originalText: text,
      correctedText: correctedText,
      shapedText: shapedText,
      historyId: historyItem.id
    });
    
  } catch (error) {
    console.error('خطأ في المعالجة:', error.response?.data || error.message);
    
    let errorMessage = 'فشل في معالجة النص';
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'لا يمكن الاتصال بالخادم';
    } else if (error.response?.status === 401) {
      errorMessage = 'مفتاح API غير صالح';
    } else if (error.response?.status === 429) {
      errorMessage = 'تم تجاوز الحد المسموح لطلبات API';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

// نقطة رفع الملفات واستخراج النص
app.post('/api/upload-and-tashkeel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'لم يتم رفع أي ملف' 
      });
    }

    const { file } = req;
    console.log(`معالجة الملف: ${file.originalname}, النوع: ${file.mimetype}`);

    const extractedText = await extractTextFromFile(file.path, file.mimetype);
    
    if (!extractedText || extractedText.trim().length === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        success: false, 
        error: 'لم يتم العثور على نص في الملف' 
      });
    }

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `أنت خبير في اللغة العربية والتشكيل. قم بتشكيل النص العربي بشكل دقيق.
            
            التعليمات:
            1. شكل كل الكلمات بشكل صحيح
            2. حافظ على تنسيق النص الأصلي
            3. لا تضيف أي تعليقات إضافية
            4. أعد النص المشكول فقط`
          },
          {
            role: 'user',
            content: `قم بتشكيل هذا النص العربي تشكيلاً كاملاً وصحيحاً:

            ${extractedText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const shapedText = response.data.choices[0].message.content.trim();

    const historyItem = {
      id: Date.now(),
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      original: extractedText,
      shaped: shapedText,
      date: new Date().toLocaleString('ar-SA'),
      timestamp: new Date()
    };

    textHistory.unshift(historyItem);
    textHistory = textHistory.slice(0, 50);

    fs.unlinkSync(file.path);

    res.json({ 
      success: true, 
      extractedText: extractedText,
      shapedText: shapedText,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      historyId: historyItem.id
    });
    
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('خطأ في معالجة الملف:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'فشل في معالجة الملف' 
    });
  }
});

// نقطة التصدير
app.post('/api/export', async (req, res) => {
  try {
    const { text, format, fileName = 'النص-المشكول' } = req.body;
    
    if (!text || !format) {
      return res.status(400).json({ 
        success: false, 
        error: 'النص وصيغة التصدير مطلوبة' 
      });
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '');
    let filePath, mimeType, downloadName;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', 'Times New Roman', serif;
            line-height: 1.8;
            font-size: 16px;
            text-align: right;
            margin: 2cm;
          }
          .header {
            text-align: center;
            margin-bottom: 2cm;
            border-bottom: 2px solid #333;
            padding-bottom: 1cm;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>النص المشكول</h1>
          <p>تم التشكيل باستخدام مشكال - ${new Date().toLocaleString('ar-SA')}</p>
        </div>
        <div class="content">
          ${text.replace(/\n/g, '<br>')}
        </div>
      </body>
      </html>
    `;

    switch (format) {
      case 'pdf':
        filePath = path.join('exports', `${safeFileName}-${Date.now()}.pdf`);
        mimeType = 'application/pdf';
        downloadName = `${safeFileName}.pdf`;
        
        await new Promise((resolve, reject) => {
          pdf.create(htmlContent, {
            format: 'A4',
            orientation: 'portrait',
            border: {
              top: '1cm',
              right: '1cm',
              bottom: '1cm',
              left: '1cm'
            }
          }).toFile(filePath, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        break;

      case 'docx':
        filePath = path.join('exports', `${safeFileName}-${Date.now()}.docx`);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        downloadName = `${safeFileName}.docx`;
        
        const docxBuffer = await htmlToDocx(htmlContent, null, {
          orientation: 'portrait'
        });
        
        fs.writeFileSync(filePath, docxBuffer);
        break;

      case 'txt':
        filePath = path.join('exports', `${safeFileName}-${Date.now()}.txt`);
        mimeType = 'text/plain';
        downloadName = `${safeFileName}.txt`;
        
        fs.writeFileSync(filePath, text, 'utf8');
        break;

      case 'jpg':
        filePath = path.join('exports', `${safeFileName}-${Date.now()}.jpg`);
        mimeType = 'image/jpeg';
        downloadName = `${safeFileName}.jpg`;
        
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(800, 1200);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 800, 1200);
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.textAlign = 'right';
        
        const lines = text.split('\n');
        let y = 100;
        lines.forEach(line => {
          ctx.fillText(line, 750, y);
          y += 30;
        });
        
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
        fs.writeFileSync(filePath, buffer);
        break;

      default:
        throw new Error('صيغة التصدير غير مدعومة');
    }

    res.json({
      success: true,
      filePath: filePath,
      downloadName: downloadName,
      mimeType: mimeType
    });

  } catch (error) {
    console.error('خطأ في التصدير:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'فشل في تصدير الملف' 
    });
  }
});

// نقطة لتحميل الملف المصدر
app.get('/api/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('exports', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'الملف غير موجود' 
      });
    }

    let mimeType = 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.txt': 'text/plain'
    };
    
    mimeType = mimeTypes[ext] || mimeType;
    const fileStats = fs.statSync(filePath);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileStats.size);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('خطأ في التحميل:', error);
    res.status(500).json({ 
      success: false, 
      error: 'فشل في تحميل الملف' 
    });
  }
});

// نقطة للحصول على السجل
app.get('/api/history', (req, res) => {
  res.json({ 
    success: true, 
    history: textHistory.slice(0, 20) 
  });
});

// نقطة لحذف عنصر من السجل
app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  textHistory = textHistory.filter(item => item.id !== parseInt(id));
  res.json({ success: true });
});

// نقطة لمسح السجل كاملاً
app.delete('/api/history', (req, res) => {
  textHistory = [];
  res.json({ success: true });
});

// نقطة لمحو جميع الملفات
app.post('/api/cleanup', async (req, res) => {
  try {
    const { cleanupType = 'all' } = req.body;
    let deletedFiles = 0;

    const deleteFilesInDir = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            deletedFiles++;
          }
        });
      }
    };

    switch (cleanupType) {
      case 'exports':
        deleteFilesInDir('exports');
        break;
      case 'uploads':
        deleteFilesInDir('uploads');
        break;
      case 'temp':
        deleteFilesInDir('temp');
        break;
      case 'all':
        deleteFilesInDir('exports');
        deleteFilesInDir('uploads');
        deleteFilesInDir('temp');
        textHistory = [];
        break;
    }

    res.json({
      success: true,
      message: `تم محو ${deletedFiles} ملفات`,
      deletedFiles
    });

  } catch (error) {
    console.error('خطأ في محو الملفات:', error);
    res.status(500).json({ 
      success: false, 
      error: 'فشل في محو الملفات' 
    });
  }
});

// نقطة للحصول على إحصائيات الملفات
app.get('/api/stats', (req, res) => {
  try {
    const getDirStats = (dirPath) => {
      if (!fs.existsSync(dirPath)) return { files: 0, size: 0 };
      const files = fs.readdirSync(dirPath);
      return { files: files.length, size: 0 };
    };

    const stats = {
      exports: getDirStats('exports'),
      uploads: getDirStats('uploads'),
      temp: getDirStats('temp'),
      history: textHistory.length
    };

    res.json({ success: true, stats });

  } catch (error) {
    console.error('خطأ في الإحصائيات:', error);
    res.status(500).json({ 
      success: false, 
      error: 'فشل في الحصول على الإحصائيات' 
    });
  }
});

// صفحة الترحيب
app.get('/', (req, res) => {
  res.json({ 
    message: 'مرحباً بك في خدمة تشكيل وتصحيح النصوص العربية',
    version: '2.0.0',
    endpoints: {
      tashkeel: 'POST /api/tashkeel',
      correction: 'POST /api/correct-text',
      tashkeel_and_correct: 'POST /api/tashkeel-and-correct',
      upload: 'POST /api/upload-and-tashkeel',
      export: 'POST /api/export',
      history: 'GET /api/history',
      cleanup: 'POST /api/cleanup',
      stats: 'GET /api/stats'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🌐 رابط الخادم: http://localhost:${PORT}`);
});