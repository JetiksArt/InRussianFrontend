import React, { useState, useEffect } from 'react';
import {
  UserRoleEnum,
  UserSystemLanguageEnum,
  CreateUserProfileRequestPeriodSpentEnum,
  CreateUserProfileRequestGenderEnum,
} from '../../api';
import type { CustomStaffRegisterRequest } from '../../api/custom-types';
import { authApi } from '../../instances/axiosInstance';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void; // callback so parent can refresh list
}

// Reuse same validation rules as AuthPage
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+\d{1,3}[-\s]?\d{1,14}([-\s]?\d{1,13})?$/;

export const UserCreateModal: React.FC<UserCreateModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [role, setRole] = useState<UserRoleEnum | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [patronymic, setPatronymic] = useState('');
  // Student-specific (basic) profile fields (optional minimal set)
  const [studentProfileEnabled, setStudentProfileEnabled] = useState(true);
  const [studentGender, setStudentGender] = useState('');
  const [studentDob, setStudentDob] = useState('');
  const [studentDor, setStudentDor] = useState('');
  const [citizenship, setCitizenship] = useState('');
  const [nationality, setNationality] = useState('');
  const [countryOfResidence, setCountryOfResidence] = useState('');
  const [cityOfResidence, setCityOfResidence] = useState('');
  const [countryDuringEducation, setCountryDuringEducation] = useState('');
  const [periodSpent, setPeriodSpent] = useState<string>('');
  const [kindOfActivity, setKindOfActivity] = useState('');
  const [education, setEducation] = useState('');
  const [purposeOfRegister, setPurposeOfRegister] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [languageSkillsEnabled, setLanguageSkillsEnabled] = useState(false);
  const [languageSkills, setLanguageSkills] = useState<Array<{language: string; understands: boolean; speaks: boolean; reads: boolean; writes: boolean;}>>([]);

  // Auto-set registration date (dor) to today's UTC date once
  useEffect(() => {
    if (!studentDor) {
      const today = new Date();
      const iso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
        .toISOString()
        .split('T')[0];
      setStudentDor(iso);
    }
  }, [studentDor]);

  if (!isOpen) return null;

  const reset = () => {
    setRole(null);
    setEmail('');
    setPassword('');
    setPhone('');
    setName('');
    setSurname('');
    setPatronymic('');
  setError(null);
  // reset dor to today again (non-editable field)
  const today = new Date();
  const iso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    .toISOString()
    .split('T')[0];
  setStudentDor(iso);
  setCitizenship('');
  setNationality('');
  setCountryOfResidence('');
  setCityOfResidence('');
  setCountryDuringEducation('');
  setPeriodSpent('');
  setKindOfActivity('');
  setEducation('');
  setPurposeOfRegister('');
  setLanguageSkillsEnabled(false);
  setLanguageSkills([]);
    setLoading(false);
  };

  const validate = () => {
    const errs: string[] = [];
    if (!emailRegex.test(email)) errs.push('Некорректный email');
    if (password.length < 6) errs.push('Пароль должен быть не короче 6 символов');
    if (!/\d/.test(password)) errs.push('Пароль должен содержать хотя бы одну цифру');
    if (!/[!@#$%^&*()_]/.test(password)) errs.push('Пароль должен содержать хотя бы один спецсимвол');
    const phoneValue = phone.trim();
    if (!phoneValue) errs.push('Телефон обязателен');
    else if (!phoneRegex.test(phoneValue)) errs.push('Некорректный формат телефона');
    if (!role) errs.push('Выберите роль');
    if (role !== UserRoleEnum.Student) { // staff only requirements
      if (!surname.trim()) errs.push('Фамилия обязательна');
      if (!name.trim()) errs.push('Имя обязательно');
    } else {
      if (!surname.trim()) errs.push('Фамилия обязательна');
      if (!name.trim()) errs.push('Имя обязательно');
      if (studentProfileEnabled) {
        if (!studentGender) errs.push('Пол обязателен');
        if (!studentDob) errs.push('Дата рождения обязательна');
        if (!studentDor) errs.push('Дата регистрации (dor) обязательна');
      }
      if (languageSkillsEnabled && !studentProfileEnabled) {
        errs.push('Чтобы добавить языковые навыки, включите профиль студента');
      }
      if (languageSkillsEnabled) {
        languageSkills.forEach((s, i) => {
          if (!s.language.trim()) errs.push(`Язык №${i + 1}: пустое название`);
        });
      }
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const errs = validate();
    if (errs.length) {
      setError(errs.join('\n'));
      return;
    }
    try {
      setLoading(true);
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      if (role === UserRoleEnum.Student) {
        // Student registration
        const { data } = await authApi.authStudentRegisterPost({
          email,
          password,
          phone,
          systemLanguage: UserSystemLanguageEnum.Russian,
          name: name.trim(),
          surname: surname.trim()
        });
        // Create full student profile (CreateUserProfileRequest)
        let profileCreated = false;
        if (studentProfileEnabled) {
          const body: any = {
            surname: surname.trim(),
            name: name.trim(),
            patronymic: patronymic.trim() || undefined,
            gender: studentGender as CreateUserProfileRequestGenderEnum,
            dob: studentDob,
            dor: studentDor,
            citizenship: citizenship || undefined,
            nationality: nationality || undefined,
            countryOfResidence: countryOfResidence || undefined,
            cityOfResidence: cityOfResidence || undefined,
            countryDuringEducation: countryDuringEducation || undefined,
            periodSpent: (periodSpent || undefined) as CreateUserProfileRequestPeriodSpentEnum | undefined,
            kindOfActivity: kindOfActivity || undefined,
            education: education || undefined,
            purposeOfRegister: purposeOfRegister || undefined,
          };
          try {
            const resp = await fetch(`${baseURL}/profiles/user`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.accessToken}`,
              },
              body: JSON.stringify(body)
            });
            profileCreated = resp.ok;
            if (!resp.ok) {
              console.error('Student profile creation failed', resp.status, await resp.text());
            }
          } catch (studentProfileErr) {
            console.error('Student profile creation failed', studentProfileErr);
          }
        }
        // Create language skills if any
        if (languageSkillsEnabled && languageSkills.length) {
          if (!studentProfileEnabled || !profileCreated) {
            console.warn('Skipping language skills: profile not created');
          } else {
            for (const skill of languageSkills) {
              const lang = skill.language.trim();
              if (!lang) continue;
              try {
                const resp = await fetch(`${baseURL}/profiles/user/language-skills`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${data.accessToken}`,
                  },
                  body: JSON.stringify({
                    language: lang,
                    understands: !!skill.understands,
                    speaks: !!skill.speaks,
                    reads: !!skill.reads,
                    writes: !!skill.writes,
                  })
                });
                if (!resp.ok) {
                  console.warn('Language skill create failed', lang, resp.status, await resp.text());
                }
              } catch (lsErr) {
                console.error('Language skill create exception', lsErr);
              }
            }
          }
        }
      } else {
        // Staff registration path
        const body: CustomStaffRegisterRequest = {
          email,
          password,
          phone,
          // @ts-ignore
          role: role,
          name,
          surname,
          patronymic: patronymic || undefined,
          // @ts-ignore
          systemLanguage: UserSystemLanguageEnum.Russian
        };

        const resp = await fetch(`${baseURL}/auth/staff/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!resp.ok) {
          throw new Error(`Staff registration failed: ${resp.status} ${await resp.text()}`);
        }
      }

      onCreated();
      reset();
      onClose();
    } catch (e) {
      console.error('Create user error', e);
      setError('Не удалось создать пользователя');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }} onClick={() => { if (!loading) { onClose(); reset(); } }}>
      <div style={{
        background: 'var(--color-card)', padding: 24, borderRadius: 12, width: '100%', maxWidth: 520,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)', color: 'var(--color-text)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain'
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Новый пользователь</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Роль:</label>
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              {[
                {value: UserRoleEnum.Admin, label: 'Администратор'},
                {value: UserRoleEnum.Expert, label: 'Эксперт'},
                {value: UserRoleEnum.ContentModerator, label: 'Менеджер'},
                {value: UserRoleEnum.Student, label: 'Студент'}
              ].map((r, idx, arr) => {
                const active = role === r.value;
                return (
                  <React.Fragment key={r.value}>
                    <button type="button" onClick={() => setRole(r.value)} style={{
                      flex: 1, padding: '10px 0', background: active ? 'var(--color-primary)' : 'transparent',
                      color: active ? '#fff' : 'var(--color-text)', border: 'none', borderRight: idx < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer', fontWeight: 600, transition: 'background .2s'
                    }}>{r.label}</button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={fieldStyle} />
            <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required style={fieldStyle} />
            <input type="tel" placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} required style={fieldStyle} />
            <input type="text" placeholder="Фамилия" value={surname} onChange={e => setSurname(e.target.value)} required style={fieldStyle} />
            <input type="text" placeholder="Имя" value={name} onChange={e => setName(e.target.value)} required style={fieldStyle} />
            <input type="text" placeholder="Отчество (необязательно)" value={patronymic} onChange={e => setPatronymic(e.target.value)} style={fieldStyle} />
            {role === UserRoleEnum.Student && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" id="stud-prof" checked={studentProfileEnabled} onChange={e => setStudentProfileEnabled(e.target.checked)} />
                  <label htmlFor="stud-prof" style={{ cursor: 'pointer' }}>Добавить базовые данные профиля</label>
                </div>
                {studentProfileEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <select value={studentGender} onChange={e => setStudentGender(e.target.value)} style={{ ...fieldStyle, padding: '10px 8px' }} required>
                        <option value="">Пол</option>
                        <option value={CreateUserProfileRequestGenderEnum.Male}>Мужской</option>
                        <option value={CreateUserProfileRequestGenderEnum.Female}>Женский</option>
                      </select>
                      <input type="date" value={studentDob} onChange={e => setStudentDob(e.target.value)} style={fieldStyle} required />
                      <input
                        type="date"
                        value={studentDor}
                        readOnly
                        disabled
                        style={{ ...fieldStyle, opacity: .7, cursor: 'not-allowed' }}
                        title="Дата регистрации устанавливается автоматически"
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <input type="text" placeholder="Гражданство" value={citizenship} onChange={e => setCitizenship(e.target.value)} style={fieldStyle} />
                      <input type="text" placeholder="Национальность" value={nationality} onChange={e => setNationality(e.target.value)} style={fieldStyle} />
                      <input type="text" placeholder="Страна проживания" value={countryOfResidence} onChange={e => setCountryOfResidence(e.target.value)} style={fieldStyle} />
                      <input type="text" placeholder="Город проживания" value={cityOfResidence} onChange={e => setCityOfResidence(e.target.value)} style={fieldStyle} />
                      <input type="text" placeholder="Страна обучения" value={countryDuringEducation} onChange={e => setCountryDuringEducation(e.target.value)} style={fieldStyle} />
                      <select value={periodSpent} onChange={e => setPeriodSpent(e.target.value)} style={{ ...fieldStyle, padding: '10px 8px' }}>
                        <option value="">Период пребывания</option>
                        <option value="MONTH_MINUS">До месяца</option>
                        <option value="MONTH_SIX_MONTHS_MINUS">1-6 месяцев</option>
                        <option value="SIX_MONTHS">6 месяцев</option>
                        <option value="YEAR_MINUS">До года</option>
                        <option value="YEAR_YEAR_PLUS">1+ года</option>
                        <option value="YEAR_PLUS">Более года</option>
                        <option value="FIVE_YEAR_PLUS">Более 5 лет</option>
                        <option value="FIVE_YEARS_PLUS">5+ лет (альт.)</option>
                        <option value="NEVER">Никогда</option>
                      </select>
                      <input type="text" placeholder="Вид деятельности" value={kindOfActivity} onChange={e => setKindOfActivity(e.target.value)} style={fieldStyle} />
                      <input type="text" placeholder="Образование" value={education} onChange={e => setEducation(e.target.value)} style={fieldStyle} />
                      <input type="text" placeholder="Цель регистрации" value={purposeOfRegister} onChange={e => setPurposeOfRegister(e.target.value)} style={fieldStyle} />
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input type="checkbox" id="stud-lang-skills" checked={languageSkillsEnabled} onChange={e => setLanguageSkillsEnabled(e.target.checked)} />
                        <label htmlFor="stud-lang-skills" style={{ cursor: 'pointer' }}>Добавить языковые навыки</label>
                        {languageSkillsEnabled && (
                          <button type="button" onClick={() => setLanguageSkills(ls => [...ls, {language: '', understands: false, speaks: false, reads: false, writes: false}])} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-card)', cursor: 'pointer', fontSize: 12 }}>+ Язык</button>
                        )}
                      </div>
                      {languageSkillsEnabled && languageSkills.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {languageSkills.map((skill, idx) => (
                            <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input type="text" placeholder="Язык" value={skill.language} onChange={e => {
                                    const val = e.target.value;
                                    setLanguageSkills(ls => ls.map((s,i)=> i===idx? {...s, language: val}: s));
                                }} style={fieldStyle} />
                                <button type="button" onClick={() => setLanguageSkills(ls => ls.filter((_,i)=>i!==idx))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #dc3545', background: 'var(--color-card)', color: '#dc3545', cursor: 'pointer' }}>✕</button>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
                                {(['understands','speaks','reads','writes'] as const).map(flag => (
                                  <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={(skill as any)[flag]} onChange={e => {
                                        const checked = e.target.checked;
                                        setLanguageSkills(ls => ls.map((s,i)=> i===idx? {...s, [flag]: checked}: s));
                                    }} />
                                    <span>{flag === 'understands' ? 'Понимает' : flag === 'speaks' ? 'Говорит' : flag === 'reads' ? 'Читает' : 'Пишет'}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {error && <div style={{ marginTop: 14, background: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: 6, whiteSpace: 'pre-line', fontSize: 14 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 }}>
            <button type="button" onClick={() => { if (!loading) { onClose(); reset(); } }} style={secondaryBtnStyle}>Отмена</button>
            <button type="submit" disabled={loading} style={{
              padding: '10px 20px', borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: loading ? .6 : 1
            }}>{loading ? 'Создание...' : 'Создать'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 6,
  background: 'var(--color-card)', color: 'var(--color-text)', boxSizing: 'border-box'
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-card)',
  color: 'var(--color-text)', cursor: 'pointer'
};

export default UserCreateModal;
