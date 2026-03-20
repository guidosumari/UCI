
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import ClinicalHistory from '../components/ClinicalHistory';

// Wrapper to use ClinicalHistory in "Create Mode"
// Note: We need to modify ClinicalHistory to support this, or we mock it here.
// Actually, ClinicalHistory takes a patientId. 
// If we want to reuse it, we might need to change ClinicalHistory to accept "initialData" or similar, 
// OR simpler: ClinicalHistory handles the "Save" by checking if patientId exists.

// Current ClinicalHistory expects patientId and fetches data.
// We'll modify ClinicalHistory to accept an optional 'mode' prop or handle 'new' id.

const NewAdmission: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <ClinicalHistory patientId="new" />
        </div>
    );
};

export default NewAdmission;
