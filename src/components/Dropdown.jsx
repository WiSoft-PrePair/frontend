import { useState, useRef, useEffect } from 'react'
import '../styles/components/Dropdown.css'

/**
 * 커스텀 드롭다운 컴포넌트
 * 모바일에서도 일관된 UI 제공
 *
 * @example
 * <Dropdown
 *   options={[
 *     { value: 'opt1', label: '옵션 1' },
 *     { value: 'opt2', label: '옵션 2', description: '설명' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 *   placeholder="선택하세요"
 * />
 */
export default function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = '선택하세요',
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedOption = options.find((opt) => opt.value === value)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (option) => {
    onChange(option.value)
    setIsOpen(false)
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div
      ref={dropdownRef}
      className={`dropdown ${isOpen ? 'dropdown--open' : ''} ${disabled ? 'dropdown--disabled' : ''} ${className}`}
    >
      <button
        type="button"
        className="dropdown__trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="dropdown__value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className="dropdown__arrow"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="dropdown__backdrop" onClick={() => setIsOpen(false)} />
          <ul className="dropdown__menu" role="listbox">
            {options.map((option) => (
              <li
                key={option.value}
                className={`dropdown__item ${option.value === value ? 'dropdown__item--selected' : ''}`}
                role="option"
                aria-selected={option.value === value}
                onClick={() => handleSelect(option)}
              >
                <span className="dropdown__item-label">{option.label}</span>
                {option.description && (
                  <span className="dropdown__item-desc">{option.description}</span>
                )}
                {option.value === value && (
                  <svg
                    className="dropdown__check"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
