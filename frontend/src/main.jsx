import React, { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  Copy, Trash2, History, Zap, Settings, Download, Upload, 
  FileText, Image, File, BookOpen, Share2, Shield, 
  BarChart3, FileDown, RefreshCw, X, Check, AlertCircle,
  Edit3, SpellCheck, GitMerge
} from 'lucide-react'
import {
  Container,
  Row,
  Col,
  Nav,
  Card,
  Button,
  Form,
  Alert,
  Modal,
  ProgressBar,
  Badge,
  Tooltip,
  OverlayTrigger
} from 'react-bootstrap'

function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [correctedText, setCorrectedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('text')
  const [processingMode, setProcessingMode] = useState('tashkeel')
  const [correctionType, setCorrectionType] = useState('all')
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' })

  // تحديد رابط API تلقائياً
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001'
    : 'https://your-app.cyclic.app' // استبدل برابط cyclic الفعلي

  const [apiConfig, setApiConfig] = useState({
    baseURL: API_BASE_URL
  })

  // عرض التنبيهات
  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type })
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 5000)
  }

  // تحميل السجل والإحصائيات
  useEffect(() => {
    loadHistory()
    loadStats()
  }, [])

  const loadHistory = async () => {
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/history`)
      const data = await response.json()
      if (data.success) {
        setHistory(data.history)
      }
    } catch (error) {
      console.error('خطأ في تحميل السجل:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/stats`)
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('خطأ في تحميل الإحصائيات:', error)
    }
  }

  // معالجة رفع الملفات
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setFileLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${apiConfig.baseURL}/api/upload-and-tashkeel`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setText(data.extractedText)
        setResult(data.shapedText)
        await loadHistory()
        showAlert(`تم معالجة الملف "${data.fileName}" بنجاح!`, 'success')
      } else {
        showAlert(`خطأ: ${data.error}`, 'danger')
      }
    } catch (error) {
      showAlert('خطأ في معالجة الملف', 'danger')
      console.error('Error:', error)
    } finally {
      setFileLoading(false)
    }
  }, [apiConfig.baseURL])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024
  })

  // معالجة أخطاء رفع الملفات
  useEffect(() => {
    if (fileRejections.length > 0) {
      const error = fileRejections[0].errors[0]
      let errorMessage = 'خطأ في رفع الملف'
      
      if (error.code === 'file-too-large') {
        errorMessage = 'حجم الملف كبير جداً. الحد الأقصى 10MB'
      } else if (error.code === 'file-invalid-type') {
        errorMessage = 'نوع الملف غير مدعوم'
      }
      
      showAlert(errorMessage, 'danger')
    }
  }, [fileRejections])

  // معالجة التشكيل
  const handleTashkeel = async () => {
    if (!text.trim()) {
      showAlert('الرجاء إدخال نص لتشكيله', 'warning')
      return
    }

    setLoading(true)
    setCorrectedText('')
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/tashkeel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          options: { preserveFormatting: true }
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(data.result)
        await loadHistory()
        showAlert('تم تشكيل النص بنجاح!', 'success')
      } else {
        showAlert(`خطأ: ${data.error}`, 'danger')
      }
    } catch (error) {
      showAlert('خطأ في الاتصال بالخادم', 'danger')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // معالجة التصحيح
  const handleCorrection = async () => {
    if (!text.trim()) {
      showAlert('الرجاء إدخال نص لتصحيحه', 'warning')
      return
    }

    setCorrectionLoading(true)
    setResult('')
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/correct-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          correctionType
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setCorrectedText(data.correctedText)
        await loadHistory()
        showAlert('تم تصحيح النص بنجاح!', 'success')
      } else {
        showAlert(`خطأ: ${data.error}`, 'danger')
      }
    } catch (error) {
      showAlert('خطأ في الاتصال بالخادم', 'danger')
      console.error('Correction Error:', error)
    } finally {
      setCorrectionLoading(false)
    }
  }

  // معالجة التشكيل والتصحيح معاً
  const handleTashkeelAndCorrect = async () => {
    if (!text.trim()) {
      showAlert('الرجاء إدخال نص لمعالجته', 'warning')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/tashkeel-and-correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          options: { preserveFormatting: true }
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setCorrectedText(data.correctedText)
        setResult(data.shapedText)
        await loadHistory()
        showAlert('تم تشكيل وتصحيح النص بنجاح!', 'success')
      } else {
        showAlert(`خطأ: ${data.error}`, 'danger')
      }
    } catch (error) {
      showAlert('خطأ في الاتصال بالخادم', 'danger')
      console.error('Processing Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // دالة المعالجة الرئيسية
  const handleProcessText = async () => {
    switch (processingMode) {
      case 'tashkeel':
        await handleTashkeel()
        break
      case 'correction':
        await handleCorrection()
        break
      case 'both':
        await handleTashkeelAndCorrect()
        break
      default:
        await handleTashkeel()
    }
  }

  // معالجة التصدير
  const handleExport = async (format) => {
    if (!result && !correctedText) {
      showAlert('لا يوجد نص للتصدير', 'warning')
      return
    }

    setExportLoading(true)
    try {
      const textToExport = result || correctedText
      const response = await fetch(`${apiConfig.baseURL}/api/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToExport,
          format: format,
          fileName: 'النص-المشكول'
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // تحميل الملف
        const downloadResponse = await fetch(`${apiConfig.baseURL}/api/download/${data.filePath.split('/').pop()}`)
        const blob = await downloadResponse.blob()
        
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.downloadName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        
        setShowExportModal(false)
        showAlert(`تم تصدير الملف كـ ${format.toUpperCase()} بنجاح!`, 'success')
        await loadStats()
      } else {
        showAlert(`خطأ في التصدير: ${data.error}`, 'danger')
      }
    } catch (error) {
      showAlert('خطأ في الاتصال بالخادم أثناء التصدير', 'danger')
      console.error('Export Error:', error)
    } finally {
      setExportLoading(false)
    }
  }

  // معالجة التنظيف
  const handleCleanup = async (cleanupType = 'all') => {
    if (!confirm('هل أنت متأكد من محو جميع الملفات؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return
    }

    try {
      const response = await fetch(`${apiConfig.baseURL}/api/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cleanupType }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setShowCleanupModal(false)
        showAlert(data.message, 'success')
        await loadStats()
        if (cleanupType === 'all') {
          setHistory([])
        }
      } else {
        showAlert(`خطأ في محو الملفات: ${data.error}`, 'danger')
      }
    } catch (error) {
      showAlert('خطأ في الاتصال بالخادم أثناء محو الملفات', 'danger')
      console.error('Cleanup Error:', error)
    }
  }

  // وظائف مساعدة
  const copyToClipboard = (textToCopy = result || correctedText) => {
    navigator.clipboard.writeText(textToCopy)
    showAlert('تم نسخ النص إلى الحافظة!', 'success')
  }

  const clearText = () => {
    setText('')
    setResult('')
    setCorrectedText('')
    showAlert('تم مسح النص', 'info')
  }

  const clearHistory = async () => {
    if (confirm('هل أنت متأكد من مسح السجل كاملاً؟')) {
      try {
        const response = await fetch(`${apiConfig.baseURL}/api/history`, {
          method: 'DELETE'
        })
        const data = await response.json()
        if (data.success) {
          setHistory([])
          setShowHistory(false)
          showAlert('تم مسح السجل', 'success')
        }
      } catch (error) {
        console.error('خطأ في مسح السجل:', error)
        showAlert('خطأ في مسح السجل', 'danger')
      }
    }
  }

  const deleteHistoryItem = async (id) => {
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/history/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setHistory(history.filter(item => item.id !== id))
        showAlert('تم حذف العنصر', 'success')
      }
    } catch (error) {
      console.error('خطأ في حذف العنصر:', error)
      showAlert('خطأ في حذف العنصر', 'danger')
    }
  }

  const downloadText = () => {
    const textToDownload = result || correctedText
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'النص-المشكول.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showAlert('تم تحميل الملف', 'success')
  }

  const loadExample = () => {
    const exampleText = `بسم الله الرحمن الرحيم
الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين
إياك نعبد وإياك نستعين اهدنا الصراط المستقيم
صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين`
    setText(exampleText)
    showAlert('تم تحميل النص التجريبي', 'info')
  }

  // مكونات الواجهة
  const FileUploadArea = () => (
    <Card className="h-100">
      <Card.Body className="d-flex flex-column">
        <div 
          {...getRootProps()} 
          className={`dropzone flex-grow-1 d-flex align-items-center justify-content-center border-3 border-dashed rounded ${
            isDragActive ? 'border-primary bg-light' : 'border-secondary'
          } ${fileLoading ? 'opacity-50' : ''}`}
          style={{ minHeight: '300px', cursor: fileLoading ? 'not-allowed' : 'pointer' }}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            {fileLoading ? (
              <>
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">جاري المعالجة...</span>
                </div>
                <h5>جاري معالجة الملف...</h5>
                <p className="text-muted">قد تستغرق العملية بضع ثوانٍ</p>
              </>
            ) : (
              <>
                <Upload size={48} className="text-primary mb-3" />
                <h4>{isDragActive ? 'أفلت الملف هنا' : 'انقر أو اسحب الملف هنا'}</h4>
                <p className="text-muted mb-3">
                  يدعم: PDF, Word, ODT, الصور, TXT (الحد الأقصى 10MB)
                </p>
                <Row className="g-2 mb-3">
                  <Col xs={6} sm={4} lg={3}>
                    <div className="file-type p-2 border rounded text-center">
                      <FileText size={20} className="text-primary mb-1" />
                      <small>PDF</small>
                    </div>
                  </Col>
                  <Col xs={6} sm={4} lg={3}>
                    <div className="file-type p-2 border rounded text-center">
                      <FileText size={20} className="text-primary mb-1" />
                      <small>DOC/DOCX</small>
                    </div>
                  </Col>
                  <Col xs={6} sm={4} lg={3}>
                    <div className="file-type p-2 border rounded text-center">
                      <BookOpen size={20} className="text-primary mb-1" />
                      <small>ODT</small>
                    </div>
                  </Col>
                  <Col xs={6} sm={4} lg={3}>
                    <div className="file-type p-2 border rounded text-center">
                      <Image size={20} className="text-primary mb-1" />
                      <small>JPG/PNG</small>
                    </div>
                  </Col>
                </Row>
              </>
            )}
          </div>
        </div>
        
        <Card className="mt-3 bg-gradient-info text-white">
          <Card.Body>
            <h6>💡 معلومات عن ملفات ODT:</h6>
            <p className="mb-1">ملفات ODT هي تنسيق OpenDocument المستخدم في:</p>
            <ul className="mb-0 ps-3">
              <li>LibreOffice Writer</li>
              <li>Apache OpenOffice Writer</li>
              <li>Google Docs (عند التحميل كـ ODT)</li>
            </ul>
          </Card.Body>
        </Card>
      </Card.Body>
    </Card>
  )

  const TextInputArea = () => (
    <Card className="h-100">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Card.Title className="mb-0">
            <FileText className="me-2" />
            أدخل النص العربي
          </Card.Title>
          <div>
            <OverlayTrigger placement="top" overlay={<Tooltip>تحميل مثال</Tooltip>}>
              <Button variant="outline-secondary" size="sm" className="me-2" onClick={loadExample}>
                مثال
              </Button>
            </OverlayTrigger>
            <OverlayTrigger placement="top" overlay={<Tooltip>مسح النص</Tooltip>}>
              <Button variant="outline-danger" size="sm" onClick={clearText}>
                <Trash2 size={16} />
              </Button>
            </OverlayTrigger>
          </div>
        </div>
        
        <Form.Control
          as="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="أدخل النص العربي الذي تريد تشكيله هنا..."
          rows={8}
          className="flex-grow-1 mb-3"
          style={{ resize: 'vertical' }}
        />
      </Card.Body>
    </Card>
  )

  const ProcessingModeSelector = () => (
    <Card className="mb-4">
      <Card.Header>
        <Card.Title className="mb-0">
          <GitMerge className="me-2" />
          اختر نوع المعالجة
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          {/* خيار التشكيل فقط */}
          <Col lg={4} md={6}>
            <Card 
              className={`h-100 border-2 ${processingMode === 'tashkeel' ? 'border-primary shadow' : 'border-light'}`}
              role="button"
              onClick={() => setProcessingMode('tashkeel')}
            >
              <Card.Body className="text-center">
                <div className="mb-3">
                  <Zap size={48} className={processingMode === 'tashkeel' ? 'text-primary' : 'text-muted'} />
                </div>
                <h5 className={processingMode === 'tashkeel' ? 'text-primary' : 'text-dark'}>
                  التشكيل فقط
                </h5>
                <p className="text-muted small mb-2">
                  إضافة الحركات (الضمة، الفتحة، الكسرة) إلى النص
                </p>
                <Badge bg={processingMode === 'tashkeel' ? 'primary' : 'outline-primary'}>
                  مناسب للنصوص الصحيحة
                </Badge>
              </Card.Body>
              {processingMode === 'tashkeel' && (
                <Card.Footer className="bg-primary text-white text-center py-2">
                  <Check size={16} className="me-1" />
                  مختار
                </Card.Footer>
              )}
            </Card>
          </Col>

          {/* خيار التصحيح فقط */}
          <Col lg={4} md={6}>
            <Card 
              className={`h-100 border-2 ${processingMode === 'correction' ? 'border-warning shadow' : 'border-light'}`}
              role="button"
              onClick={() => setProcessingMode('correction')}
            >
              <Card.Body className="text-center">
                <div className="mb-3">
                  <SpellCheck size={48} className={processingMode === 'correction' ? 'text-warning' : 'text-muted'} />
                </div>
                <h5 className={processingMode === 'correction' ? 'text-warning' : 'text-dark'}>
                  التصحيح فقط
                </h5>
                <p className="text-muted small mb-2">
                  تصحيح الأخطاء الإملائية والنحوية دون إضافة حركات
                </p>
                <div className="mb-2">
                  <Form.Select 
                    size="sm"
                    value={correctionType} 
                    onChange={(e) => setCorrectionType(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="all">الكل (إملائي + نحوي)</option>
                    <option value="spelling">إملائي فقط</option>
                    <option value="grammar">نحوي فقط</option>
                  </Form.Select>
                </div>
              </Card.Body>
              {processingMode === 'correction' && (
                <Card.Footer className="bg-warning text-dark text-center py-2">
                  <Check size={16} className="me-1" />
                  مختار
                </Card.Footer>
              )}
            </Card>
          </Col>

          {/* خيار التصحيح + التشكيل */}
          <Col lg={4} md={6}>
            <Card 
              className={`h-100 border-2 ${processingMode === 'both' ? 'border-success shadow' : 'border-light'}`}
              role="button"
              onClick={() => setProcessingMode('both')}
            >
              <Card.Body className="text-center">
                <div className="mb-3">
                  <GitMerge size={48} className={processingMode === 'both' ? 'text-success' : 'text-muted'} />
                </div>
                <h5 className={processingMode === 'both' ? 'text-success' : 'text-dark'}>
                  تصحيح + تشكيل
                </h5>
                <p className="text-muted small mb-2">
                  معالجة شاملة: تصحيح الأخطاء ثم إضافة الحركات
                </p>
                <Badge bg={processingMode === 'both' ? 'success' : 'outline-success'}>
                  المعالجة الكاملة
                </Badge>
              </Card.Body>
              {processingMode === 'both' && (
                <Card.Footer className="bg-success text-white text-center py-2">
                  <Check size={16} className="me-1" />
                  مختار
                </Card.Footer>
              )}
            </Card>
          </Col>
        </Row>

        {/* زر المعالجة الرئيسي */}
        <Row className="mt-4">
          <Col>
            <div className="d-grid">
              <Button 
                variant={
                  processingMode === 'tashkeel' ? 'primary' :
                  processingMode === 'correction' ? 'warning' : 'success'
                }
                size="lg"
                onClick={handleProcessText}
                disabled={loading || correctionLoading || !text.trim()}
                className="py-3"
              >
                {loading || correctionLoading ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">جاري المعالجة...</span>
                    </div>
                    {processingMode === 'both' ? 'جاري المعالجة...' : 
                     processingMode === 'correction' ? 'جاري التصحيح...' : 'جاري التشكيل...'}
                  </>
                ) : (
                  <>
                    {processingMode === 'both' ? <GitMerge size={20} className="me-2" /> :
                     processingMode === 'correction' ? <SpellCheck size={20} className="me-2" /> :
                     <Zap size={20} className="me-2" />}
                    {processingMode === 'both' ? 'صحح وشكل النص' : 
                     processingMode === 'correction' ? 'صحح النص' : 'شكل النص'}
                  </>
                )}
              </Button>
            </div>
          </Col>
        </Row>

        {/* معلومات مساعدة */}
        <Row className="mt-3">
          <Col>
            <Alert variant="info" className="mb-0">
              <div className="d-flex align-items-center">
                <AlertCircle size={20} className="me-2 flex-shrink-0" />
                <div>
                  <strong>نصائح للاستخدام:</strong>
                  <ul className="mb-0 mt-1">
                    <li><strong>التشكيل فقط:</strong> للنصوص الصحيحة التي تحتاج فقط إلى حركات</li>
                    <li><strong>التصحيح فقط:</strong> للنصوص التي تحتاج إلى تصحيح أخطاء دون حركات</li>
                    <li><strong>تصحيح + تشكيل:</strong> للمعالجة الشاملة للنصوص التي تحتاج كلا الخدمتين</li>
                  </ul>
                </div>
              </div>
            </Alert>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )

  const ResultsArea = () => {
    const getResultTitle = () => {
      switch (processingMode) {
        case 'tashkeel':
          return { title: 'النص المشكول', icon: Check, color: 'success' }
        case 'correction':
          return { 
            title: 'النص المصحح', 
            icon: SpellCheck, 
            color: 'warning',
            subtitle: `(${correctionType === 'all' ? 'إملائي + نحوي' : correctionType === 'spelling' ? 'إملائي' : 'نحوي'})`
          }
        case 'both':
          return { title: 'النص المصحح والمشكول', icon: GitMerge, color: 'success' }
        default:
          return { title: 'النتيجة', icon: Check, color: 'success' }
      }
    }

    const resultInfo = getResultTitle()
    const ResultIcon = resultInfo.icon

    return (
      <>
        {(result || correctedText) && (
          <Card className="mt-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <Card.Title className="mb-0">
                  <ResultIcon className={`me-2 text-${resultInfo.color}`} />
                  {resultInfo.title}
                  {resultInfo.subtitle && (
                    <Badge bg="warning" className="ms-2">
                      {resultInfo.subtitle}
                    </Badge>
                  )}
                </Card.Title>
              </div>
              <div>
                <OverlayTrigger placement="top" overlay={<Tooltip>تصدير النتيجة</Tooltip>}>
                  <Button variant="outline-primary" size="sm" className="me-2" onClick={() => setShowExportModal(true)}>
                    <FileDown size={16} className="me-1" />
                    تصدير
                  </Button>
                </OverlayTrigger>
                <OverlayTrigger placement="top" overlay={<Tooltip>نسخ النتيجة</Tooltip>}>
                  <Button variant="outline-secondary" size="sm" onClick={() => copyToClipboard()}>
                    <Copy size={16} className="me-1" />
                    نسخ
                  </Button>
                </OverlayTrigger>
              </div>
            </Card.Header>
            <Card.Body>
              {/* عرض النص المصحح فقط */}
              {processingMode === 'correction' && correctedText && (
                <div 
                  className="corrected-text p-3 border rounded bg-light"
                  style={{ 
                    minHeight: '200px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    lineHeight: '1.8',
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                >
                  {correctedText}
                </div>
              )}

              {/* عرض النص المشكول فقط */}
              {processingMode === 'tashkeel' && result && (
                <div 
                  className="result-text p-3 border rounded bg-light"
                  style={{ 
                    minHeight: '200px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    lineHeight: '2',
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                >
                  {result}
                </div>
              )}

              {/* عرض النص المصحح والمشكول معاً */}
              {processingMode === 'both' && result && correctedText && (
                <Row>
                  <Col md={6}>
                    <h6 className="text-warning mb-2">
                      <SpellCheck size={16} className="me-1" />
                      النص المصحح:
                    </h6>
                    <div 
                      className="corrected-text p-3 border rounded bg-light mb-3"
                      style={{ 
                        minHeight: '180px',
                        maxHeight: '350px',
                        overflowY: 'auto',
                        lineHeight: '1.8',
                        textAlign: 'right',
                        direction: 'rtl'
                      }}
                    >
                      {correctedText}
                    </div>
                    <div className="d-grid">
                      <Button 
                        variant="outline-warning" 
                        size="sm"
                        onClick={() => setText(correctedText)}
                      >
                        <Edit3 size={16} className="me-1" />
                        استخدام النص المصحح للإدخال
                      </Button>
                    </div>
                  </Col>
                  <Col md={6}>
                    <h6 className="text-success mb-2">
                      <Zap size={16} className="me-1" />
                      النص المشكول:
                    </h6>
                    <div 
                      className="result-text p-3 border rounded bg-light mb-3"
                      style={{ 
                        minHeight: '180px',
                        maxHeight: '350px',
                        overflowY: 'auto',
                        lineHeight: '2',
                        textAlign: 'right',
                        direction: 'rtl'
                      }}
                    >
                      {result}
                    </div>
                    <div className="d-grid">
                      <Button 
                        variant="outline-success" 
                        size="sm"
                        onClick={downloadText}
                      >
                        <Download size={16} className="me-1" />
                        تحميل النص المشكول
                      </Button>
                    </div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        )}
      </>
    )
  }

  const HistoryArea = () => (
    <Card className="mt-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <Card.Title className="mb-0">
          <History className="me-2" />
          سجل التشكيل
          <Badge bg="secondary" className="ms-2">{history.length}</Badge>
        </Card.Title>
        <div>
          {history.length > 0 && (
            <OverlayTrigger placement="top" overlay={<Tooltip>مسح السجل كاملاً</Tooltip>}>
              <Button variant="outline-danger" size="sm" className="me-2" onClick={clearHistory}>
                <Trash2 size={16} className="me-1" />
                مسح الكل
              </Button>
            </OverlayTrigger>
          )}
          <Button 
            variant="outline-secondary" 
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'إخفاء' : 'عرض'}
          </Button>
        </div>
      </Card.Header>
      
      {showHistory && (
        <Card.Body>
          {history.length === 0 ? (
            <div className="text-center text-muted py-4">
              <History size={48} className="mb-2 opacity-25" />
              <p>لا توجد عمليات سابقة</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <Card key={item.id} className="mb-3">
                  <Card.Body>
                    {item.fileName && (
                      <div className="file-info d-flex align-items-center mb-2 p-2 bg-light rounded">
                        <File size={16} className="text-primary me-2" />
                        <strong>{item.fileName}</strong>
                        <Badge bg="outline-secondary" className="ms-2" text="dark">
                          {item.fileType}
                        </Badge>
                      </div>
                    )}
                    <Row>
                      <Col md={6}>
                        <strong className="text-primary">النص الأصلي:</strong>
                        <div className="text-preview p-2 border rounded mt-1 bg-white">
                          {item.original}
                        </div>
                      </Col>
                      <Col md={6}>
                        <strong className="text-success">النص المشكول:</strong>
                        <div className="text-preview p-2 border rounded mt-1 bg-white">
                          {item.shaped}
                        </div>
                      </Col>
                    </Row>
                    <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                      <small className="text-muted">{item.date}</small>
                      <div>
                        <OverlayTrigger placement="top" overlay={<Tooltip>نسخ النص المشكول</Tooltip>}>
                          <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => copyToClipboard(item.shaped)}>
                            <Copy size={14} />
                          </Button>
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip>حذف العنصر</Tooltip>}>
                          <Button variant="outline-danger" size="sm" onClick={() => deleteHistoryItem(item.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </OverlayTrigger>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Card.Body>
      )}
    </Card>
  )

  // نوافذ منبثقة
  const ExportModal = () => (
    <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FileDown className="me-2" />
          تصدير النص
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>اختر صيغة التصدير المناسبة:</p>
        <Row className="g-3">
          <Col xs={6}>
            <Card className="export-option h-100 text-center" role="button" onClick={() => handleExport('pdf')}>
              <Card.Body>
                <FileText size={32} className="text-primary mb-2" />
                <h6>PDF</h6>
                <small className="text-muted">ملف قابل للطباعة</small>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6}>
            <Card className="export-option h-100 text-center" role="button" onClick={() => handleExport('docx')}>
              <Card.Body>
                <FileText size={32} className="text-primary mb-2" />
                <h6>Word</h6>
                <small className="text-muted">مستند قابل للتعديل</small>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6}>
            <Card className="export-option h-100 text-center" role="button" onClick={() => handleExport('txt')}>
              <Card.Body>
                <File size={32} className="text-primary mb-2" />
                <h6>نص عادي</h6>
                <small className="text-muted">ملف نصي بسيط</small>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6}>
            <Card className="export-option h-100 text-center" role="button" onClick={() => handleExport('jpg')}>
              <Card.Body>
                <Image size={32} className="text-primary mb-2" />
                <h6>صورة</h6>
                <small className="text-muted">للمشاركة</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        {exportLoading && (
          <div className="text-center mt-3">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">جاري إنشاء الملف...</span>
            </div>
            <p className="text-muted mt-2">جاري إنشاء الملف...</p>
          </div>
        )}
      </Modal.Body>
    </Modal>
  )

  const CleanupModal = () => (
    <Modal show={showCleanupModal} onHide={() => setShowCleanupModal(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <Shield className="me-2" />
          تنظيف النظام
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="cleanup-stats mb-4">
          <h6>الإحصائيات الحالية:</h6>
          {stats ? (
            <Row className="g-2 mt-2">
              <Col xs={6}>
                <Card className="text-center">
                  <Card.Body className="py-2">
                    <div className="text-primary fw-bold">{stats.exports.files}</div>
                    <small>الملفات المصدرة</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6}>
                <Card className="text-center">
                  <Card.Body className="py-2">
                    <div className="text-primary fw-bold">{stats.uploads.files}</div>
                    <small>الملفات المرفوعة</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6}>
                <Card className="text-center">
                  <Card.Body className="py-2">
                    <div className="text-primary fw-bold">{stats.history}</div>
                    <small>عمليات السجل</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6}>
                <Card className="text-center">
                  <Card.Body className="py-2">
                    <div className="text-primary fw-bold">
                      {((stats.exports.size + stats.uploads.size) / 1024 / 1024).toFixed(1)}MB
                    </div>
                    <small>الحجم الكلي</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : (
            <div className="text-center py-3">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">جاري التحميل...</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="cleanup-options">
          <h6>خيارات التنظيف:</h6>
          <Card className="mb-2" role="button" onClick={() => handleCleanup('exports')}>
            <Card.Body className="py-3">
              <div className="d-flex align-items-center">
                <Shield size={20} className="text-primary me-3" />
                <div>
                  <strong>محو الملفات المصدرة فقط</strong>
                  <small className="d-block text-muted">يحافظ على السجل والملفات المرفوعة</small>
                </div>
              </div>
            </Card.Body>
          </Card>
          
          <Card className="mb-2" role="button" onClick={() => handleCleanup('uploads')}>
            <Card.Body className="py-3">
              <div className="d-flex align-items-center">
                <Shield size={20} className="text-primary me-3" />
                <div>
                  <strong>محو الملفات المرفوعة فقط</strong>
                  <small className="d-block text-muted">يحافظ على السجل والملفات المصدرة</small>
                </div>
              </div>
            </Card.Body>
          </Card>
          
          <Card className="border-danger" role="button" onClick={() => handleCleanup('all')}>
            <Card.Body className="py-3">
              <div className="d-flex align-items-center">
                <Trash2 size={20} className="text-danger me-3" />
                <div>
                  <strong className="text-danger">محو الكل</strong>
                  <small className="d-block text-muted">جميع الملفات والسجل - لا يمكن التراجع</small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </Modal.Body>
    </Modal>
  )

  return (
    <div className="app" dir="rtl">
      {/* الهيدر */}
      <header className="bg-primary text-white shadow-sm">
        <Container>
          <Row className="py-4">
            <Col>
              <div className="text-center">
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <Zap size={32} className="me-3" />
                  <h1 className="h2 mb-0">مشكال</h1>
                </div>
                <p className="lead mb-0 opacity-75">تشكيل وتصحيح النصوص العربية باستخدام الذكاء الاصطناعي</p>
              </div>
            </Col>
          </Row>
        </Container>
      </header>

      {/* التنبيهات */}
      <Container className="mt-3">
        {alert.show && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert({ show: false, message: '', type: 'info' })}>
            {alert.message}
          </Alert>
        )}
      </Container>

      {/* المحتوى الرئيسي */}
      <Container className="py-4">
        {/* شريط التحكم */}
        <Card className="mb-4">
          <Card.Body>
            <Row className="align-items-center">
              <Col md={8}>
                <div className="d-flex flex-wrap gap-2">
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => setShowExportModal(true)}
                    disabled={!result && !correctedText}
                  >
                    <FileDown size={16} className="me-1" />
                    تصدير
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={() => setShowCleanupModal(true)}
                  >
                    <Shield size={16} className="me-1" />
                    تنظيف
                  </Button>
                  <Button 
                    variant="outline-info" 
                    size="sm"
                    onClick={loadStats}
                  >
                    <BarChart3 size={16} className="me-1" />
                    إحصائيات
                  </Button>
                </div>
              </Col>
              <Col md={4}>
                {stats && (
                  <div className="d-flex justify-content-md-end flex-wrap gap-2 mt-2 mt-md-0">
                    <Badge bg="light" text="dark">
                      📁 {stats.exports.files} مصدر
                    </Badge>
                    <Badge bg="light" text="dark">
                      📊 {stats.uploads.files} مرفوع
                    </Badge>
                    <Badge bg="light" text="dark">
                      📝 {stats.history} عملية
                    </Badge>
                  </div>
                )}
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* التبويبات */}
        <Card className="mb-4">
          <Card.Body className="p-0">
            <Nav variant="pills" className="p-3">
              <Nav.Item>
                <Nav.Link 
                  active={activeTab === 'text'}
                  onClick={() => setActiveTab('text')}
                  className="d-flex align-items-center"
                >
                  <FileText size={18} className="me-2" />
                  إدخال نصي
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  active={activeTab === 'file'}
                  onClick={() => setActiveTab('file')}
                  className="d-flex align-items-center"
                >
                  <Upload size={18} className="me-2" />
                  رفع ملف
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Body>
        </Card>

        {/* اختيار وضع المعالجة */}
        <ProcessingModeSelector />

        {/* منطقة الإدخال */}
        <Row>
          <Col lg={8}>
            {activeTab === 'text' ? <TextInputArea /> : <FileUploadArea />}
          </Col>
          <Col lg={4}>
            <Card>
              <Card.Header>
                <Card.Title className="mb-0">
                  <Settings size={18} className="me-2" />
                  الإعدادات
                </Card.Title>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>رابط الخادم:</Form.Label>
                  <Form.Control
                    type="text"
                    value={apiConfig.baseURL}
                    onChange={(e) => setApiConfig({...apiConfig, baseURL: e.target.value})}
                    placeholder="رابط API"
                  />
                  <Form.Text className="text-muted">
                    {apiConfig.baseURL}
                  </Form.Text>
                </Form.Group>
                <div className="d-grid">
                  <Button variant="outline-primary" onClick={loadStats}>
                    <RefreshCw size={16} className="me-2" />
                    تحديث الإحصائيات
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* النتائج */}
        <ResultsArea />

        {/* السجل */}
        <HistoryArea />
      </Container>

      {/* النوافذ المنبثقة */}
      <ExportModal />
      <CleanupModal />

      {/* الفوتر */}
      <footer className="bg-dark text-light py-4 mt-5">
        <Container>
          <Row>
            <Col>
              <p className="text-center mb-0">
                تم التطوير باستخدام DeepSeek API &copy; {new Date().getFullYear()}
              </p>
            </Col>
          </Row>
        </Container>
      </footer>
    </div>
  )
}

export default App