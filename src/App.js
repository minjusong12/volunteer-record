import React, { useState, useEffect } from 'react';
import { Camera, Plus, ArrowLeft, X, Upload, MessageCircle, Trash2, Shield, Edit, ChevronDown } from 'lucide-react';

// Supabase 설정
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD;

class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`
    };
  }

  async fetch(endpoint, options = {}) {
    const response = await fetch(`${this.url}/rest/v1${endpoint}`, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const text = await response.text();
    if (!text) {
      return [];
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('JSON parse error:', error, 'Response text:', text);
      throw new Error('Invalid JSON response from server');
    }
  }

  async select(table, query = '') {
    return this.fetch(`/${table}${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  }

  async insert(table, data) {
    return this.fetch(`/${table}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async update(table, data, condition) {
    return this.fetch(`/${table}?${condition}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete(table, condition) {
    return this.fetch(`/${table}?${condition}`, {
      method: 'DELETE'
    });
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VolunteerRecordApp = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('main');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCommentDeleteModal, setShowCommentDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [commentPassword, setCommentPassword] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [newComment, setNewComment] = useState({ nickname: '', password: '', content: '' });
  const [sortOrder, setSortOrder] = useState('newest');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    organization: '',
    hours: '',
    location: '',
    participants: '',
    description: '',
    author_name: '',
    author_password: ''
  });

  // 데이터 로드
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      // 기록과 댓글을 함께 불러오기
      const recordsData = await supabase.select('records', 'select=*&order=created_at.desc');
      const commentsData = await supabase.select('comments', 'select=*&order=created_at.asc');
      
      // 각 기록에 댓글 연결
      const recordsWithComments = recordsData.map(record => ({
        ...record,
        comments: commentsData.filter(comment => comment.record_id === record.id)
      }));
      
      setRecords(recordsWithComments);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('데이터를 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCommentChange = (field, value) => {
    setNewComment(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    const remainingSlots = 10 - selectedPhotos.length;
    const filesToAdd = files.slice(0, remainingSlots);

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedPhotos(prev => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });

    if (files.length > remainingSlots) {
      alert(`최대 10장까지만 업로드할 수 있습니다. ${filesToAdd.length}장이 추가되었습니다.`);
    }
  };

  const removePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      name: '',
      organization: '',
      hours: '',
      location: '',
      participants: '',
      description: '',
      author_name: '',
      author_password: ''
    });
    setSelectedPhotos([]);
  };

  const addRecord = async () => {
    const { date, name, organization, hours, author_name, author_password } = formData;
    
    if (!date || !name || !organization || !hours || !author_name || !author_password) {
      alert('필수 항목을 모두 입력해주세요!');
      return;
    }

    try {
      const newRecord = {
        date,
        name,
        organization,
        hours: parseFloat(hours),
        location: formData.location || null,
        participants: formData.participants || null,
        description: formData.description || null,
        author_name,
        author_password,
        photos: selectedPhotos
      };

      await supabase.insert('records', newRecord);
      await loadRecords(); // 데이터 새로고침
      setShowModal(false);
      resetForm();
      alert('봉사활동 기록이 추가되었습니다!');
    } catch (error) {
      console.error('기록 추가 실패:', error);
      alert('기록 추가에 실패했습니다.');
    }
  };

  const openEditModal = (record) => {
    setEditTarget(record);
    setFormData({
      date: record.date,
      name: record.name,
      organization: record.organization,
      hours: record.hours.toString(),
      location: record.location || '',
      participants: record.participants || '',
      description: record.description || '',
      author_name: record.author_name,
      author_password: ''
    });
    setSelectedPhotos([...(record.photos || [])]);
    setShowEditModal(true);
    setEditPassword('');
  };

  const updateRecord = async () => {
    if (editPassword !== editTarget.author_password) {
      alert('비밀번호가 틀렸습니다.');
      return;
    }

    const { date, name, organization, hours } = formData;
    
    if (!date || !name || !organization || !hours) {
      alert('필수 항목을 모두 입력해주세요!');
      return;
    }

    try {
      const updatedData = {
        date,
        name,
        organization,
        hours: parseFloat(hours),
        location: formData.location || null,
        participants: formData.participants || null,
        description: formData.description || null,
        photos: selectedPhotos
      };

      await supabase.update('records', updatedData, `id=eq.${editTarget.id}`);
      await loadRecords(); // 데이터 새로고침
      
      setShowEditModal(false);
      setEditTarget(null);
      setEditPassword('');
      resetForm();
      setCurrentView('main'); // 메인으로 돌아가기
      alert('기록이 수정되었습니다!');
    } catch (error) {
      console.error('기록 수정 실패:', error);
      alert('기록 수정에 실패했습니다.');
    }
  };

  const openDeleteModal = (recordId) => {
    setDeleteTarget(recordId);
    setShowDeleteModal(true);
    setAdminPassword('');
  };

  const deleteRecord = async () => {
    if (adminPassword !== ADMIN_PASSWORD) {
      alert('관리자 비밀번호가 틀렸습니다.');
      return;
    }
    
    try {
      // 관련 댓글도 함께 삭제
      await supabase.delete('comments', `record_id=eq.${deleteTarget}`);
      await supabase.delete('records', `id=eq.${deleteTarget}`);
      
      await loadRecords(); // 데이터 새로고침
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setAdminPassword('');
      setCurrentView('main');
      alert('기록이 삭제되었습니다.');
    } catch (error) {
      console.error('기록 삭제 실패:', error);
      alert('기록 삭제에 실패했습니다.');
    }
  };

  const addComment = async (recordId) => {
    if (!newComment.nickname.trim() || !newComment.password.trim() || !newComment.content.trim()) {
      alert('닉네임, 비밀번호, 댓글 내용을 모두 입력해주세요.');
      return;
    }

    try {
      const comment = {
        record_id: recordId,
        nickname: newComment.nickname.trim(),
        password: newComment.password,
        content: newComment.content.trim(),
        timestamp: new Date().toLocaleString('ko-KR')
      };

      await supabase.insert('comments', comment);
      await loadRecords(); // 데이터 새로고침
      
      // 선택된 기록 업데이트
      const updatedRecord = records.find(r => r.id === recordId);
      if (updatedRecord) {
        setSelectedRecord({
          ...updatedRecord,
          comments: [...(updatedRecord.comments || []), { ...comment, id: Date.now() }]
        });
      }

      setNewComment({ nickname: '', password: '', content: '' });
      alert('댓글이 추가되었습니다!');
    } catch (error) {
      console.error('댓글 추가 실패:', error);
      alert('댓글 추가에 실패했습니다.');
    }
  };

  const openCommentDeleteModal = (comment) => {
    setCommentToDelete(comment);
    setShowCommentDeleteModal(true);
    setCommentPassword('');
  };

  const deleteComment = async () => {
    if (commentPassword !== commentToDelete.password) {
      alert('비밀번호가 틀렸습니다.');
      return;
    }

    try {
      await supabase.delete('comments', `id=eq.${commentToDelete.id}`);
      await loadRecords(); // 데이터 새로고침
      
      // 선택된 기록 업데이트
      if (selectedRecord) {
        setSelectedRecord(prev => ({
          ...prev,
          comments: prev.comments.filter(c => c.id !== commentToDelete.id)
        }));
      }

      setShowCommentDeleteModal(false);
      setCommentToDelete(null);
      setCommentPassword('');
      alert('댓글이 삭제되었습니다.');
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const formatDateKorean = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  // 정렬된 기록 가져오기
  const getSortedRecords = () => {
    return [...records].sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.date) - new Date(a.date);
      } else {
        return new Date(a.date) - new Date(b.date);
      }
    });
  };

  const totalHours = records.reduce((sum, record) => sum + (record.hours || 0), 0);
  const totalComments = records.reduce((sum, record) => sum + (record.comments?.length || 0), 0);
  const sortedRecords = getSortedRecords();

  // Supabase 설정 확인
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">🔧 Supabase 설정이 필요합니다</h1>
            <div className="text-left bg-gray-100 p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">1. Supabase 프로젝트 생성:</p>
              <p className="text-sm text-gray-600 mb-4">
                • <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">supabase.com</a>에서 새 프로젝트 생성<br/>
                • 프로젝트 이름: volunteer-record
              </p>
              
              <p className="font-semibold mb-2">2. 테이블 생성:</p>
              <p className="text-sm text-gray-600 mb-4">
                SQL Editor에서 아래 코드를 실행하세요:
              </p>
              <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-x-auto mb-4">
{`-- records 테이블
CREATE TABLE records (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  date DATE,
  name TEXT,
  organization TEXT,
  hours REAL,
  location TEXT,
  participants TEXT,
  description TEXT,
  author_name TEXT,
  author_password TEXT,
  photos TEXT[]
);

-- comments 테이블  
CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  record_id BIGINT REFERENCES records(id),
  nickname TEXT,
  password TEXT,
  content TEXT,
  timestamp TEXT
);`}
              </pre>
              
              <p className="font-semibold mb-2">3. 코드 수정:</p>
              <p className="text-sm text-gray-600">
                Settings → API에서 URL과 anon key를 복사해서<br/>
                코드 상단의 SUPABASE_URL과 SUPABASE_ANON_KEY를 교체하세요.
              </p>
            </div>
            <p className="text-sm text-gray-500">
              설정 완료 후 페이지를 새로고침하세요! 🚀
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-auto">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {currentView === 'detail' && (
              <button
                onClick={() => setCurrentView('main')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                [매월 1회] 소중한 봉사 기록장
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                주최자는 진행한 봉사 활동 기록을 남겨주시고<br/>
                참석자는 해당 기록에 댓글로 간단한 후기/소감을 남겨주세요
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 md:px-6 py-2.5 rounded-lg font-semibold flex items-center gap-1 md:gap-2 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 whitespace-nowrap"
          >
            <Plus size={16} className="md:block hidden" />
            <Plus size={14} className="md:hidden block" />
            <span className="text-sm md:text-base">등록</span>
          </button>
        </div>
      </header>

      {/* 메인 뷰 */}
      {currentView === 'main' && (
        <div className="max-w-4xl mx-auto p-5">
          {/* 통계 섹션 */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8 flex justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{records.length}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">게시글</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{totalHours}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">총 봉사 시간</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{totalComments}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">후기 댓글</div>
            </div>
          </div>

          {/* 갤러리 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">봉사활동 기록</h2>
              {records.length > 0 && (
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="appearance-none bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    <option value="newest">최신순</option>
                    <option value="oldest">오래된 순</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              )}
            </div>
            
            {records.length === 0 ? (
              <div className="p-16 text-center text-gray-500">
                <Camera size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">아직 봉사활동 기록이 없습니다</p>
                <p className="text-sm">우측 상단의 '+ 등록' 버튼을 눌러 첫 번째 기록을 추가해보세요!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-1">
                {sortedRecords.map(record => (
                  <div
                    key={record.id}
                    onClick={() => {
                      setSelectedRecord(record);
                      setCurrentView('detail');
                    }}
                    className="aspect-square relative cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {record.photos && record.photos.length > 0 ? (
                      <img
                        src={record.photos[0]}
                        alt={record.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-col text-gray-400">
                        <Camera size={32} className="mb-2" />
                        <span className="text-xs">사진 없음</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <div className="text-white text-xs opacity-90 mb-1">
                        {formatDateKorean(record.date)}
                      </div>
                      <div className="text-white text-sm font-semibold line-clamp-1">
                        {record.name}
                      </div>
                      {record.comments && record.comments.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <MessageCircle size={12} className="text-white opacity-80" />
                          <span className="text-white text-xs opacity-80">{record.comments.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 상세 뷰 */}
      {currentView === 'detail' && selectedRecord && (
        <div className="max-w-4xl mx-auto p-5">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">{selectedRecord.name}</h1>
                  <p className="text-gray-600 text-lg mb-1">{formatDateKorean(selectedRecord.date)}</p>
                  <p className="text-sm text-gray-500">등록자: {selectedRecord.author_name}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(selectedRecord)}
                    className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Edit size={16} />
                    <span className="text-sm">수정</span>
                  </button>
                  <button
                    onClick={() => openDeleteModal(selectedRecord.id)}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Shield size={16} />
                    <span className="text-sm">관리자 삭제</span>
                  </button>
                </div>
              </div>
            </div>

            {selectedRecord.photos && selectedRecord.photos.length > 0 && (
              <div className="p-6 border-b border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedRecord.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`활동 사진 ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => {
                        const modal = document.createElement('div');
                        modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
                        modal.innerHTML = `<img src="${photo}" class="max-w-full max-h-full rounded-lg shadow-2xl">`;
                        modal.onclick = () => document.body.removeChild(modal);
                        document.body.appendChild(modal);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 border-b border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-600 mb-1">기관/단체</div>
                  <div className="text-gray-800">{selectedRecord.organization}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-600 mb-1">봉사 시간</div>
                  <div className="text-gray-800">{selectedRecord.hours}시간</div>
                </div>
                {selectedRecord.location && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-gray-600 mb-1">활동 장소</div>
                    <div className="text-gray-800">{selectedRecord.location}</div>
                  </div>
                )}
                {selectedRecord.participants && (
                  <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                    <div className="text-sm font-semibold text-gray-600 mb-1">참석자</div>
                    <div className="text-gray-800">{selectedRecord.participants}</div>
                  </div>
                )}
              </div>
            </div>

            {selectedRecord.description && (
              <div className="p-6 border-b border-gray-100">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-600 mb-2">활동 내용</div>
                  <div className="text-gray-800 whitespace-pre-wrap">{selectedRecord.description}</div>
                </div>
              </div>
            )}

            {/* 댓글 섹션 */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle size={20} className="text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-800">
                  댓글 {selectedRecord.comments?.length || 0}개
                </h3>
              </div>

              {/* 댓글 목록 */}
              <div className="space-y-4 mb-6">
                {selectedRecord.comments?.map(comment => (
                  <div key={comment.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{comment.nickname}</span>
                        <span className="text-sm text-gray-500">{comment.timestamp}</span>
                      </div>
                      <button
                        onClick={() => openCommentDeleteModal(comment)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                )) || (
                  <p className="text-gray-500 text-center py-4">아직 댓글이 없습니다.</p>
                )}
              </div>

              {/* 댓글 작성 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="닉네임"
                    value={newComment.nickname}
                    onChange={(e) => handleCommentChange('nickname', e.target.value)}
                    className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="password"
                    placeholder="비밀번호 (댓글 삭제시 필요)"
                    value={newComment.password}
                    onChange={(e) => handleCommentChange('password', e.target.value)}
                    className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <textarea
                  placeholder="댓글을 작성해주세요..."
                  value={newComment.content}
                  onChange={(e) => handleCommentChange('content', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical mb-3"
                />
                <button
                  onClick={() => addComment(selectedRecord.id)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                >
                  댓글 작성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">새 봉사활동 기록</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">등록자 *</label>
                  <input
                    type="text"
                    value={formData.author_name}
                    onChange={(e) => handleInputChange('author_name', e.target.value)}
                    placeholder="본인 이름을 입력해주세요"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">비밀번호 *</label>
                  <input
                    type="password"
                    value={formData.author_password}
                    onChange={(e) => handleInputChange('author_password', e.target.value)}
                    placeholder="수정시 필요한 비밀번호"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">활동 날짜 *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">활동 이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="예: 요양원 말벗 봉사"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">기관/단체 *</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => handleInputChange('organization', e.target.value)}
                    placeholder="예: 해피요양원"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">봉사 시간 *</label>
                  <input
                    type="number"
                    value={formData.hours}
                    onChange={(e) => handleInputChange('hours', e.target.value)}
                    min="0"
                    step="0.5"
                    placeholder="예: 3"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">활동 장소</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="예: 서울시 강남구"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">참석자</label>
                  <input
                    type="text"
                    value={formData.participants}
                    onChange={(e) => handleInputChange('participants', e.target.value)}
                    placeholder="예: 홍길동, 김철수, 이영희"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* 사진 업로드 */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">활동 사진 (최대 10장)</label>
                <div
                  onClick={() => document.getElementById('photo-input').click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50"
                >
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Upload size={40} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 font-medium mb-2">사진을 업로드해주세요</p>
                  <p className="text-sm text-gray-500">클릭하거나 드래그해서 업로드 (최대 10장)</p>
                </div>
                
                {selectedPhotos.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {selectedPhotos.map((photo, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={photo}
                          alt={`미리보기 ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">활동 내용</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="활동한 내용을 자세히 적어주세요..."
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical"
                />
              </div>

              <button
                onClick={addRecord}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                기록 추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">봉사활동 기록 수정</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditTarget(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">비밀번호 확인 *</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="등록시 입력한 비밀번호를 입력해주세요"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">활동 날짜 *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">활동 이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="예: 요양원 말벗 봉사"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">기관/단체 *</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => handleInputChange('organization', e.target.value)}
                    placeholder="예: 해피요양원"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">봉사 시간 *</label>
                  <input
                    type="number"
                    value={formData.hours}
                    onChange={(e) => handleInputChange('hours', e.target.value)}
                    min="0"
                    step="0.5"
                    placeholder="예: 3"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">활동 장소</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="예: 서울시 강남구"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">참석자</label>
                  <input
                    type="text"
                    value={formData.participants}
                    onChange={(e) => handleInputChange('participants', e.target.value)}
                    placeholder="예: 홍길동, 김철수, 이영희"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* 사진 업로드 */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">활동 사진 (최대 10장)</label>
                <div
                  onClick={() => document.getElementById('edit-photo-input').click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50"
                >
                  <input
                    id="edit-photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Upload size={40} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 font-medium mb-2">사진을 업로드해주세요</p>
                  <p className="text-sm text-gray-500">클릭하거나 드래그해서 업로드 (최대 10장)</p>
                </div>
                
                {selectedPhotos.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {selectedPhotos.map((photo, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={photo}
                          alt={`미리보기 ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">활동 내용</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="활동한 내용을 자세히 적어주세요..."
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical"
                />
              </div>

              <button
                onClick={updateRecord}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                기록 수정하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 삭제 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="text-red-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-800">관리자 인증</h3>
            </div>
            <p className="text-gray-600 mb-4">기록을 삭제하려면 관리자 비밀번호를 입력해주세요.</p>
            <input
              type="password"
              placeholder="관리자 비밀번호"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors mb-4"
              onKeyPress={(e) => e.key === 'Enter' && deleteRecord()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                  setAdminPassword('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={deleteRecord}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 댓글 삭제 모달 */}
      {showCommentDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="text-blue-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-800">댓글 삭제</h3>
            </div>
            <p className="text-gray-600 mb-4">댓글을 삭제하려면 작성시 입력한 비밀번호를 입력해주세요.</p>
            <input
              type="password"
              placeholder="댓글 비밀번호"
              value={commentPassword}
              onChange={(e) => setCommentPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-4"
              onKeyPress={(e) => e.key === 'Enter' && deleteComment()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCommentDeleteModal(false);
                  setCommentToDelete(null);
                  setCommentPassword('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={deleteComment}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolunteerRecordApp;







