import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL, { apiCall } from '../config/api';
import { sanitizeIdProofInput, validateIdProofNumber } from '../utils/idProofValidation';

const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const BLOCKED_UPLOAD_EXTENSIONS = /\.(exe|js)$/i;

const validateImageUploadFile = (file, fieldLabel) => {
    if (!file) return `${fieldLabel}: file not found`;

    const fileName = String(file.name || '').trim();
    const mimeType = String(file.type || '').toLowerCase();

    if (BLOCKED_UPLOAD_EXTENSIONS.test(fileName)) {
        return `${fieldLabel}: executable files (.exe/.js) are not allowed`;
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        return `${fieldLabel}: only JPG and PNG files are allowed`;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        return `${fieldLabel}: file size must be 2MB or less`;
    }

    return null;
};

const CreateGuestForm = ({ onSave, onCancel, existingGuests = [], editingGuest = null }) => {
    const [activeSection, setActiveSection] = useState('basic'); // basic, address, kyc, optional
    const [errors, setErrors] = useState({});
    const [successMessage, setSuccessMessage] = useState('');
    const [fieldToFocus, setFieldToFocus] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const requiredFieldOrder = ['mobile', 'email'];
    const fieldSectionMap = {
        fullName: 'basic',
        mobile: 'basic',
        email: 'basic',
        address: 'address',
        city: 'address'
    };

    const getCreateGuestEndpoints = () => {
        const baseCandidates = API_URL
            ? [API_URL]
            : (import.meta.env.DEV ? ['', 'http://localhost:5001', 'http://localhost:5000'] : ['']);

        return [...new Set(baseCandidates)]
            .map((base) => `${base}/api/guests/add`)
            .map((url) => url.replace(/([^:]\/)\/+/g, '$1'));
    };

    const getRequestHeaders = () => {
        const headers = {
            'Content-Type': 'application/json'
        };

        try {
            const savedUser = localStorage.getItem('authUser');
            if (!savedUser) return headers;

            const parsed = JSON.parse(savedUser);
            if (parsed?.token) {
                headers.Authorization = `Bearer ${parsed.token}`;
            }
            if (parsed?.hotelId) {
                headers['x-hotel-id'] = parsed.hotelId;
            }
            if (parsed?.dbName) {
                headers['x-tenant-db'] = parsed.dbName;
            }
        } catch (error) {
            console.warn('Failed to parse authUser for headers:', error);
        }

        return headers;
    };

    // ID Validation Helper Function
    const validateIDNumber = (idType, idNumber) => {
        if (!idType || !idNumber.trim()) return null;
        const validation = validateIdProofNumber(idType, idNumber);
        return validation.isValid ? null : validation.message;
    };

    const [formData, setFormData] = useState({
        // Basic Information
        fullName: '',
        mobile: '',
        email: '',
        gender: 'Male',
        nationality: 'Indian',

        // Address Details
        address: '',
        city: '',
        state: '',
        country: 'India',
        pinCode: '',

        // ID Proof / KYC
        idType: '', // Aadhaar, Passport, Driving License, Voter ID
        idNumber: '',
        idFrontFile: null,
        idBackFile: null,

        // Optional Details
        dob: '',
        anniversary: '',
        photoFile: null,
        companyName: '',
        gstNumber: ''
    });

    // Pre-fill form when editing
    useEffect(() => {
        if (editingGuest) {
            const guestAddress = typeof editingGuest.address === 'object' ? (editingGuest.address || {}) : {};
            const guestIdProof = editingGuest.idProof || {};
            setFormData({
                fullName: editingGuest.fullName || editingGuest.name || '',
                mobile: editingGuest.mobile || editingGuest.phone || '',
                email: editingGuest.email || '',
                gender: editingGuest.gender || 'Male',
                nationality: editingGuest.nationality || 'Indian',
                address: (typeof editingGuest.address === 'object' ? guestAddress.line : editingGuest.address) || '',
                city: editingGuest.city || guestAddress.city || '',
                state: editingGuest.state || guestAddress.state || '',
                country: editingGuest.country || guestAddress.country || 'India',
                pinCode: editingGuest.pinCode || guestAddress.pinCode || '',
                idType: editingGuest.idType || guestIdProof.type || '',
                idNumber: editingGuest.idNumber || editingGuest.idProofNumber || guestIdProof.number || '',
                idFrontFile: null,
                idBackFile: null,
                dob: editingGuest.dob || '',
                anniversary: editingGuest.anniversary || '',
                photoFile: null,
                companyName: editingGuest.companyName || '',
                gstNumber: editingGuest.gstNumber || ''
            });
        }
    }, [editingGuest]);

    // Dummy guest history data
    const [showHistory, setShowHistory] = useState(false);
    const bookingHistory = [
        {
            id: 'RES-001',
            roomCategory: 'Deluxe Double',
            checkIn: '2025-10-15',
            checkOut: '2025-10-18',
            amount: '₹9,500'
        },
        {
            id: 'RES-002',
            roomCategory: 'Club AC Single',
            checkIn: '2024-08-20',
            checkOut: '2024-08-23',
            amount: '₹7,200'
        },
        {
            id: 'RES-003',
            roomCategory: 'Suite Double',
            checkIn: '2024-05-10',
            checkOut: '2024-05-13',
            amount: '₹15,000'
        },
        {
            id: 'RES-004',
            roomCategory: 'Club AC Double',
            checkIn: '2024-03-05',
            checkOut: '2024-03-08',
            amount: '₹12,000'
        },
        {
            id: 'RES-005',
            roomCategory: 'Deluxe AC Single',
            checkIn: '2023-12-20',
            checkOut: '2023-12-23',
            amount: '₹6,500'
        },
        {
            id: 'RES-006',
            roomCategory: 'Executive Suite',
            checkIn: '2023-10-10',
            checkOut: '2023-10-15',
            amount: '₹27,500'
        },
        {
            id: 'RES-007',
            roomCategory: 'Club Non-AC Double',
            checkIn: '2023-07-22',
            checkOut: '2023-07-25',
            amount: '₹8,700'
        },
        {
            id: 'RES-008',
            roomCategory: 'Deluxe Non-AC',
            checkIn: '2023-05-05',
            checkOut: '2023-05-10',
            amount: '₹7,500'
        },
        {
            id: 'RES-009',
            roomCategory: 'Suite Double',
            checkIn: '2023-02-14',
            checkOut: '2023-02-17',
            amount: '₹16,500'
        },
        {
            id: 'RES-010',
            roomCategory: 'Club AC Single',
            checkIn: '2022-11-28',
            checkOut: '2022-12-01',
            amount: '₹8,400'
        }
    ];

    // Validation Rules
    const validateField = (fieldName, value) => {
        let error = '';

        switch (fieldName) {
            case 'fullName':
                if (!value.trim()) error = 'Full Name is required';
                else if (value.trim().length < 3) error = 'Full Name must be at least 3 characters (minimum)';
                else if (value.trim().length > 50) error = 'Full Name should not exceed 50 characters';
                else if (!/^[a-zA-Z\s.'-]+$/.test(value)) error = 'Full Name can only contain letters, spaces, and hyphens';
                break;

            case 'mobile':
                if (!value.trim()) error = 'Mobile Number is required';
                else if (!/^[0-9]{10}$/.test(value.replace(/\s+/g, ''))) error = 'Mobile must be exactly 10 digits';
                else if (existingGuests.some(g => g.mobile === value)) error = 'This mobile number is already registered';
                break;

            case 'email':
                if (!value.trim()) error = 'Email Address is required';
                else if (!/^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) error = 'Please enter a valid email address';
                break;

            case 'address':
                if (value.trim() && value.trim().length < 5) error = 'Please enter a complete address (minimum 5 characters)';
                break;

            case 'city':
                if (value.trim() && !/^[a-zA-Z\s'-]+$/.test(value)) error = 'City name should only contain letters';
                break;

            case 'state':
                if (value && !/^[a-zA-Z\s'-]+$/.test(value)) error = 'State name should only contain letters';
                break;

            case 'idNumber':
                if (formData.idType && !value.trim()) {
                    error = 'ID Number is required when ID Type is selected';
                } else if (formData.idType && value.trim()) {
                    error = validateIDNumber(formData.idType, value);
                }
                break;

            case 'dob':
            case 'anniversary':
                if (value && new Date(value) > new Date()) error = `${fieldName === 'dob' ? 'Date of Birth' : 'Anniversary'} cannot be in the future`;
                else if (fieldName === 'dob' && value) {
                    const age = new Date().getFullYear() - new Date(value).getFullYear();
                    if (age < 10) error = 'Guest must be at least 10 years old';
                    if (age > 150) error = 'Please enter a valid date of birth';
                }
                break;


            case 'pinCode':
                if (value && !/^[0-9]{6}$/.test(value)) error = 'PIN Code must be exactly 6 digits';
                break;

            case 'gstNumber':
                if (value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) error = 'Please enter a valid GST Number format';
                break;

            default:
                break;
        }

        return error;
    };

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;

        if (type === 'file') {
            const file = files?.[0];
            if (!file) return;

            const fieldLabelMap = {
                idFrontFile: 'ID Front',
                idBackFile: 'ID Back',
                photoFile: 'Guest Photo'
            };

            const validationError = validateImageUploadFile(file, fieldLabelMap[name] || 'Image Upload');
            if (validationError) {
                setErrors(prev => ({
                    ...prev,
                    [name]: validationError
                }));
                window.alert(validationError);
                e.target.value = '';
                return;
            }

            setFormData(prev => ({
                ...prev,
                [name]: file
            }));

            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        } else {
            let normalizedValue = value;

            if (name === 'idNumber') {
                normalizedValue = sanitizeIdProofInput(formData.idType, value);
            }

            const error = validateField(name, normalizedValue);
            setFormData(prev => ({
                ...prev,
                [name]: normalizedValue,
                ...(name === 'idType' ? { idNumber: '' } : {})
            }));

            if (error) {
                setErrors(prev => ({
                    ...prev,
                    [name]: error
                }));
            } else {
                setErrors(prev => ({
                    ...prev,
                    [name]: '',
                    ...(name === 'idType' ? { idNumber: '' } : {})
                }));
            }
        }
    };

    useEffect(() => {
        if (!fieldToFocus) return;

        const timer = setTimeout(() => {
            const targetField = document.querySelector(`[name="${fieldToFocus}"]`);
            if (targetField) {
                targetField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetField.focus();
            }
            setFieldToFocus('');
        }, 80);

        return () => clearTimeout(timer);
    }, [fieldToFocus, activeSection]);

    const validateForm = (sourceData = formData) => {
        const newErrors = {};

        // Basic Information Validation
        if (sourceData.fullName.trim() && sourceData.fullName.trim().length < 3) {
            newErrors.fullName = 'Full Name must be at least 3 characters';
        } else if (sourceData.fullName.trim() && sourceData.fullName.trim().length > 50) {
            newErrors.fullName = 'Full Name should not exceed 50 characters';
        } else if (sourceData.fullName.trim() && !/^[a-zA-Z\s.'-]+$/.test(sourceData.fullName)) {
            newErrors.fullName = 'Full Name can only contain letters, spaces, hyphens, and apostrophes';
        }

        if (!sourceData.mobile.trim()) {
            newErrors.mobile = 'Mobile Number is required';
        } else if (!/^[0-9]{10}$/.test(sourceData.mobile.replace(/\s+/g, ''))) {
            newErrors.mobile = 'Mobile must be exactly 10 digits';
        } else if (existingGuests.some(g => g.mobile === sourceData.mobile)) {
            newErrors.mobile = 'This mobile number is already registered';
        }

        if (!sourceData.email.trim()) {
            newErrors.email = 'Email Address is required';
        } else if (!/^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sourceData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Address Validation (optional)
        const addressVal = typeof sourceData.address === 'object' ? (sourceData.address?.line || '') : String(sourceData.address || '');
        if (addressVal.trim() && addressVal.trim().length < 5) {
            newErrors.address = 'Please enter a complete address (minimum 5 characters)';
        }

        if (sourceData.city.trim() && !/^[a-zA-Z\s'-]+$/.test(sourceData.city)) {
            newErrors.city = 'City name should only contain letters';
        }

        if (sourceData.state && !/^[a-zA-Z\s'-]+$/.test(sourceData.state)) {
            newErrors.state = 'State name should only contain letters';
        }


        if (sourceData.pinCode && !/^[0-9]{6}$/.test(sourceData.pinCode)) {
            newErrors.pinCode = 'PIN Code must be exactly 6 digits';
        }

        // KYC Validation
        if (sourceData.idType && !sourceData.idNumber.trim()) {
            newErrors.idNumber = 'ID Number is required when ID Type is selected';
        } else if (sourceData.idType && sourceData.idNumber.trim()) {
            const idError = validateIDNumber(sourceData.idType, sourceData.idNumber);
            if (idError) {
                newErrors.idNumber = idError;
            }
        }

        // Optional Fields Validation
        if (sourceData.dob) {
            if (new Date(sourceData.dob) > new Date()) {
                newErrors.dob = 'Date of Birth cannot be in the future';
            } else {
                const age = new Date().getFullYear() - new Date(sourceData.dob).getFullYear();
                if (age < 10) {
                    newErrors.dob = 'Guest must be at least 10 years old';
                }
                if (age > 150) {
                    newErrors.dob = 'Please enter a valid date of birth';
                }
            }
        }

        if (sourceData.anniversary && new Date(sourceData.anniversary) > new Date()) {
            newErrors.anniversary = 'Anniversary date cannot be in the future';
        }

        if (sourceData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(sourceData.gstNumber)) {
            newErrors.gstNumber = 'Please enter a valid GST Number (e.g., 27AABBS5055K2ZU)';
        }

        setErrors(newErrors);
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const autoGeneratedFullName = formData.fullName.trim() || `Guest ${String(formData.mobile || '').slice(-4) || '0000'}`;
        const preparedData = {
            ...formData,
            fullName: autoGeneratedFullName
        };

        if (!formData.fullName.trim()) {
            setFormData(prev => ({ ...prev, fullName: autoGeneratedFullName }));
        }

        const validationErrors = validateForm(preparedData);

        if (Object.keys(validationErrors).length > 0) {
            setSuccessMessage('');

            const missingRequiredFields = requiredFieldOrder.filter((key) => !String(formData[key] || '').trim());
            const firstMissingField = missingRequiredFields[0];

            if (firstMissingField) {
                const targetSection = fieldSectionMap[firstMissingField] || 'basic';
                if (activeSection !== targetSection) {
                    setActiveSection(targetSection);
                }
                setFieldToFocus(firstMissingField);
            }

            if (missingRequiredFields.length > 0) {
                window.alert('Please fill all mandatory fields before creating guest profile.');
            } else {
                window.alert('Please fix highlighted field errors before submitting.');

                const firstInvalidField = Object.keys(validationErrors).find((key) => Boolean(validationErrors[key]));
                if (firstInvalidField) {
                    const targetSection = fieldSectionMap[firstInvalidField] || 'basic';
                    if (activeSection !== targetSection) {
                        setActiveSection(targetSection);
                    }
                    setFieldToFocus(firstInvalidField);
                }
            }
            return;
        }

        setErrors(prev => ({ ...prev, submit: '' }));
        setIsSubmitting(true);

        const idProofPayload = {
            ...(preparedData.idType ? { type: preparedData.idType } : {}),
            ...(preparedData.idNumber ? { number: preparedData.idNumber } : {}),
            ...(preparedData.idFrontFile || preparedData.idBackFile
                ? {
                    files: [
                        ...(preparedData.idFrontFile ? [{ url: preparedData.idFrontFile, type: 'front' }] : []),
                        ...(preparedData.idBackFile ? [{ url: preparedData.idBackFile, type: 'back' }] : [])
                    ]
                }
                : {})
        };

        const newGuest = {
            fullName: preparedData.fullName,
            mobile: preparedData.mobile,
            email: preparedData.email,
            gender: preparedData.gender,
            nationality: preparedData.nationality,
            address: {
                line: preparedData.address,
                city: preparedData.city,
                state: preparedData.state,
                country: preparedData.country,
                pinCode: preparedData.pinCode
            },
            ...(Object.keys(idProofPayload).length > 0 ? { idProof: idProofPayload } : {}),
            dob: preparedData.dob,
            anniversary: preparedData.anniversary,
            photoFile: preparedData.photoFile,
            companyName: preparedData.companyName,
            gstNumber: preparedData.gstNumber
        };

        try {
            let response;

            // Extract guest ID from editingGuest
            const guestId = editingGuest?._id || editingGuest?.id || editingGuest?.guestId;

            console.log('🔍 ===== EDIT MODE DEBUG =====');
            console.log('editingGuest prop:', editingGuest);
            console.log('editingGuest._id:', editingGuest?._id);
            console.log('editingGuest.id:', editingGuest?.id);
            console.log('editingGuest.guestId:', editingGuest?.guestId);
            console.log('Extracted guestId:', guestId);
            console.log('Is Edit Mode?:', !!editingGuest && !!guestId);
            console.log('Request Data:', newGuest);
            console.log('=============================');

            if (editingGuest && guestId) {
                // ✅ EDIT MODE - Update existing guest
                console.log('🔥 EDIT MODE TRIGGERED');
                console.log('Guest ID:', guestId);
                console.log('Form Data:', newGuest);

                const updateUrl = `${API_URL}/api/guests/${guestId}`;
                console.log('📝 PUT Request URL:', updateUrl);

                response = await apiCall(updateUrl, {
                    method: 'PUT',
                    headers: getRequestHeaders(),
                    body: JSON.stringify(newGuest)
                });

                console.log('📝 PUT Request sent successfully');
            } else {
                // ✅ CREATE MODE - Create new guest
                console.log('➕ CREATE MODE TRIGGERED');
                console.log('Form Data:', newGuest);

                const createUrls = getCreateGuestEndpoints();
                let lastCreateError = null;

                for (const createUrl of createUrls) {
                    try {
                        console.log('➕ POST Request URL:', createUrl);
                        const candidateResponse = await apiCall(createUrl, {
                            method: 'POST',
                            headers: getRequestHeaders(),
                            body: JSON.stringify(newGuest)
                        });

                        // In dev fallback mode, keep trying next endpoint on server-side errors.
                        const canRetryOnStatus = import.meta.env.DEV && (candidateResponse.status >= 500 || candidateResponse.status === 404);

                        if (canRetryOnStatus) {
                            lastCreateError = new Error(`Endpoint ${createUrl} returned status ${candidateResponse.status}`);
                            continue;
                        }

                        response = candidateResponse;
                        break;
                    } catch (endpointError) {
                        lastCreateError = endpointError;
                        console.warn(`Create guest failed on ${createUrl}:`, endpointError?.message || endpointError);
                    }
                }

                if (!response) {
                    throw lastCreateError || new Error('Unable to reach create guest API endpoint');
                }

                console.log('➕ POST Request sent successfully');
            }

            console.log('📡 Response status:', response.status);
            let data = null;
            try {
                data = await response.json();
            } catch (parseError) {
                data = { success: false, message: `Invalid server response (${response.status})` };
            }
            console.log('📦 Full Response data:', data);
            console.log('📦 Response data.success:', data.success);
            console.log('📦 Response data.data:', data.data);

            if (data.success) {
                const successMsg = editingGuest ? 'Guest updated successfully!' : 'Guest created successfully!';
                console.log('✅', successMsg);
                console.log('✅ Updated Guest Object:', data.data);
                console.log('✅ Guest _id:', data.data?._id);
                console.log('✅ Guest fullName:', data.data?.fullName);
                setSuccessMessage(successMsg);

                // Call onSave immediately after showing success message
                setTimeout(() => {
                    console.log('🚀 Calling onSave with:', data.data);
                    onSave(data.data); // Pass the saved/updated guest with _id from backend
                }, 300); // Fast response for better UX
            } else {
                const backendErrorDetail = typeof data.error === 'string' ? data.error : '';
                const rateLimitHit = response.status === 429;
                const errorMsg = rateLimitHit
                    ? 'Too many requests. Please wait a moment and try again.'
                    : (data.message
                    || backendErrorDetail
                    || (editingGuest ? 'Failed to update guest' : 'Failed to create guest'));
                console.error('❌ Error:', errorMsg);
                setErrors({ submit: errorMsg });
            }
        } catch (error) {
            const errorMsg = editingGuest ? 'Error updating guest:' : 'Error creating guest:';
            console.error('❌', errorMsg, error);
            const submitError = (editingGuest ? 'Failed to update guest.' : 'Failed to create guest.') + ' Please try again.';
            setErrors({ submit: submitError });
        } finally {
            setIsSubmitting(false);
        }
    };

    const sections = [
        { id: 'basic', label: 'Basic Info', icon: '' },
        { id: 'address', label: 'Address', icon: '' },
        { id: 'kyc', label: 'ID Proof', icon: '' },
        { id: 'optional', label: 'More Info', icon: '' }
    ];

    return (
        <div className="create-guest-form">
            {/* Header - Only show when creating new guest */}
            {!editingGuest && (
                <div className="form-header-section">
                    <h3 className="form-title">Create New Guest Profile</h3>
                    <p className="form-subtitle">Fill in the guest details to create a new profile</p>
                </div>
            )}

            {/* Success Message */}
            <AnimatePresence>
                {successMessage && (
                    <div className="success-note-overlay">
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="success-note"
                        >
                            <span className="success-icon">✓</span>
                            {successMessage}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Back Button */}
            <div className="back-button-container">
                <button
                    type="button"
                    className="btn-back-guest"
                    onClick={onCancel}
                >
                    ← Back
                </button>
            </div>

            {/* Section Tabs */}
            <div className="form-section-tabs">
                {sections.map(section => (
                    <button
                        key={section.id}
                        className={`section-tab ${activeSection === section.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(section.id)}
                    >
                        <span className="tab-icon">{section.icon}</span>
                        <span className="tab-label">{section.label}</span>
                    </button>
                ))}
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="guest-form-content">
                {/* BASIC INFORMATION SECTION */}
                {activeSection === 'basic' && (
                    <div className="form-section">
                        <h4 className="section-title">Basic Information</h4>
                        <p className="section-subtitle">* Required fields</p>

                        <div className="form-group">
                            <div className="label-wrapper">
                                <label>Full Name</label>
                                <span className="char-count">{formData.fullName.length}/50</span>
                            </div>
                            <input
                                type="text"
                                name="fullName"
                                placeholder="e.g., John Doe"
                                value={formData.fullName}
                                onChange={handleChange}
                                maxLength="50"
                                className={errors.fullName ? 'input-error' : ''}
                            />
                            {errors.fullName && <span className="form-error-text">{errors.fullName}</span>}
                            {!errors.fullName && formData.fullName && <span className="form-success-text"><span className="form-success-icon"></span> Valid name</span>}
                        </div>

                        <div className="form-group">
                            <div className="label-wrapper">
                                <label>Mobile Number <span className="required-mark">*</span></label>
                                <span className="char-count">{formData.mobile.length}/10</span>
                            </div>
                            <input
                                type="tel"
                                name="mobile"
                                placeholder="10 digit mobile number"
                                value={formData.mobile}
                                onChange={handleChange}
                                maxLength="10"
                                className={errors.mobile ? 'input-error' : ''}
                            />
                            {errors.mobile && <span className="form-error-text">{errors.mobile}</span>}
                            {!errors.mobile && formData.mobile && <span className="form-success-text"><span className="form-success-icon"></span> Valid mobile number</span>}
                        </div>

                        <div className="form-group">
                            <label>Email Address <span className="required-mark">*</span></label>
                            <input
                                type="email"
                                name="email"
                                placeholder="guest@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                className={errors.email ? 'input-error' : ''}
                            />
                            {errors.email && <span className="form-error-text">{errors.email}</span>}
                            {!errors.email && formData.email && <span className="form-success-text"><span className="form-success-icon"></span> Valid email</span>}
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange}>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Nationality</label>
                                <select name="nationality" value={formData.nationality} onChange={handleChange}>
                                    <option value="Indian">Indian</option>
                                    <option value="US">US</option>
                                    <option value="UK">UK</option>
                                    <option value="Australia">Australia</option>
                                    <option value="Others">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* ADDRESS SECTION */}
                {activeSection === 'address' && (
                    <div className="form-section">
                        <h4 className="section-title">Address Details</h4>
                        <p className="section-subtitle">Recommended for KYC completion</p>

                        <div className="form-group">
                            <label>Address Line</label>
                            <input
                                type="text"
                                name="address"
                                placeholder="Street address (e.g., 123 Main Street)"
                                value={formData.address}
                                onChange={handleChange}
                                className={errors.address ? 'input-error' : ''}
                            />
                            {errors.address && <span className="form-error-text">{errors.address}</span>}
                        </div>

                        <div className="form-row-3">
                            <div className="form-group">
                                <div className="label-wrapper">
                                    <label>City</label>
                                </div>
                                <input
                                    type="text"
                                    name="city"
                                    placeholder="e.g., Mumbai"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className={errors.city ? 'input-error' : ''}
                                />
                                {errors.city && <span className="form-error-text">{errors.city}</span>}
                            </div>

                            <div className="form-group">
                                <div className="label-wrapper">
                                    <label>State</label>
                                </div>
                                <input
                                    type="text"
                                    name="state"
                                    placeholder="e.g., Maharashtra"
                                    value={formData.state}
                                    onChange={handleChange}
                                    className={errors.state ? 'input-error' : ''}
                                />
                                {errors.state && <span className="form-error-text">{errors.state}</span>}
                            </div>

                            <div className="form-group">
                                <div className="label-wrapper">
                                    <label>PIN Code</label>
                                </div>
                                <input
                                    type="text"
                                    name="pinCode"
                                    placeholder="6 digit code"
                                    value={formData.pinCode}
                                    onChange={handleChange}
                                    maxLength="6"
                                    className={errors.pinCode ? 'input-error' : ''}
                                />
                                {errors.pinCode && <span className="form-error-text">{errors.pinCode}</span>}
                                {!errors.pinCode && formData.pinCode && <span className="form-success-text"><span className="form-success-icon"></span> Valid PIN Code</span>}
                            </div>

                        </div>

                        <div className="form-group">
                            <div className="label-wrapper">
                                <label>Country</label>
                            </div>
                            <select name="country" value={formData.country} onChange={handleChange}>
                                <option value="India">India</option>
                                <option value="US">United States</option>
                                <option value="UK">United Kingdom</option>
                                <option value="Australia">Australia</option>
                                <option value="Others">Other</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* KYC / ID PROOF SECTION */}
                {activeSection === 'kyc' && (
                    <div className="form-section">
                        <h4 className="section-title">ID Proof / KYC Verification</h4>
                        <p className="section-subtitle">Required at check-in. Upload clear images.</p>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>ID Type</label>
                                <select name="idType" value={formData.idType} onChange={handleChange} className="id-type-input">
                                    <option value="">-- Select ID Type --</option>
                                    <option value="Aadhaar">Aadhaar</option>
                                    <option value="Passport">Passport</option>
                                    <option value="Driving License">Driving License</option>
                                    <option value="Voter ID">Voter ID</option>
                                    <option value="PAN Card">PAN Card</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>ID Number {formData.idType && <span className="required-mark">*</span>}</label>
                                <input
                                    type="text"
                                    name="idNumber"
                                    placeholder={formData.idType ? `Enter your ${formData.idType} number` : 'Select ID Type first'}
                                    value={formData.idNumber}
                                    onChange={handleChange}
                                    disabled={!formData.idType}
                                    className={`id-number-input ${errors.idNumber ? 'input-error' : ''}`}
                                />
                                {errors.idNumber && <span className="form-error-text">{errors.idNumber}</span>}
                                {!errors.idNumber && formData.idNumber && <span className="form-success-text"><span className="form-success-icon"></span> Valid ID number</span>}
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>ID Front (Upload)</label>
                                <input
                                    type="file"
                                    id="idFrontUpload"
                                    name="idFrontFile"
                                    accept="image/png,image/jpeg"
                                    onChange={handleChange}
                                    style={{ display: 'none' }}
                                />
                                <div
                                    className={`upload-box ${formData.idFrontFile ? 'uploaded' : ''}`}
                                    onClick={() => document.getElementById('idFrontUpload').click()}
                                >
                                    {formData.idFrontFile ? `✔ ${formData.idFrontFile.name}` : 'Click to upload front page'}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>ID Back (Upload)</label>
                                <input
                                    type="file"
                                    id="idBackUpload"
                                    name="idBackFile"
                                    accept="image/png,image/jpeg"
                                    onChange={handleChange}
                                    style={{ display: 'none' }}
                                />
                                <div
                                    className={`upload-box ${formData.idBackFile ? 'uploaded' : ''}`}
                                    onClick={() => document.getElementById('idBackUpload').click()}
                                >
                                    {formData.idBackFile ? `✔ ${formData.idBackFile.name}` : 'Click to upload back page'}
                                </div>
                            </div>
                        </div>

                        {!(formData.idFrontFile && formData.idBackFile) && (
                            <div className="kyc-info-box">
                                <span className="info-icon"></span>
                                <div className="info-content">
                                    <p><strong>KYC Information</strong></p>
                                    <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem' }}>
                                        Upload clear, readable images of ID documents. Ensure all details are visible. Required for check-in completion.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* OPTIONAL INFORMATION SECTION */}
                {activeSection === 'optional' && (
                    <div className="form-section">
                        <h4 className="section-title">Optional Details</h4>
                        <p className="section-subtitle">Additional information for guest profile</p>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>Date of Birth</label>
                                <input
                                    type="date"
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleChange}
                                    className={errors.dob ? 'input-error' : ''}
                                />
                                {errors.dob && <span className="error-text">{errors.dob}</span>}
                                {!errors.dob && formData.dob && <span className="success-text"><span className="success-icon">✓</span> Valid date</span>}
                            </div>

                            <div className="form-group">
                                <label>Anniversary</label>
                                <input
                                    type="date"
                                    name="anniversary"
                                    value={formData.anniversary}
                                    onChange={handleChange}
                                    className={errors.anniversary ? 'input-error' : ''}
                                />
                                {errors.anniversary && <span className="error-text">{errors.anniversary}</span>}
                                {!errors.anniversary && formData.anniversary && <span className="success-text"><span className="success-icon">✓</span> Valid date</span>}
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    placeholder="e.g., Acme Corporation"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label>GST Number</label>
                                <input
                                    type="text"
                                    name="gstNumber"
                                    placeholder="e.g., 27AABBS5055K2ZU"
                                    value={formData.gstNumber}
                                    onChange={handleChange}
                                    className={errors.gstNumber ? 'input-error' : ''}
                                />
                                {errors.gstNumber && <span className="error-text">{errors.gstNumber}</span>}
                                {!errors.gstNumber && formData.gstNumber && <span className="success-text"><span className="success-icon">✓</span> Valid GST Number</span>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Guest Photo (Upload)</label>
                            <div className="file-input-wrapper">
                                <input
                                    type="file"
                                    name="photoFile"
                                    accept="image/png,image/jpeg"
                                    onChange={handleChange}
                                />
                                <span className="file-label">
                                    {formData.photoFile ? '✓ ' + formData.photoFile.name : 'Click to upload profile photo'}
                                </span>
                            </div>
                        </div>


                    </div>
                )}

                {errors.submit && <div className="form-error-text">{errors.submit}</div>}

                {/* Form Actions */}
                <div className="form-actions-guest">
                    <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Please wait...' : (editingGuest ? 'Save' : 'Create Guest Profile')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateGuestForm;

