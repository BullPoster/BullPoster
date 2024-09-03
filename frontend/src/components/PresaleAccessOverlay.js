import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import { grantPresaleAccess, verifyEmail } from '../utils/api';

const PresaleAccessOverlay = ({ onClose, onAccessGranted }) => {
  const { publicKey } = useWallet();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [hasAgreed, setHasAgreed] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState('email'); // 'email' or 'verification'

  const handleSubmitEmail = async (e) => {
    e.preventDefault();
    if (!publicKey) {
      setErrorMessage('Please connect your wallet first.');
      return;
    }
    if (!hasAgreed) {
      setErrorMessage('You must agree to the Privacy Policy and Terms of Service');
      return;
    }
    try {
      await grantPresaleAccess({ 
        email, 
        agreed_to_terms: hasAgreed,
        public_key: publicKey.toString()
      });
      setStep('verification');
    } catch (error) {
      console.error('Error granting presale access:', error);
      setErrorMessage('Failed to grant presale access. Please try again.');
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    try {
      await verifyEmail({
        email,
        verification_code: verificationCode,
        public_key: publicKey.toString()
      });
      onAccessGranted();
    } catch (error) {
      console.error('Error verifying email:', error);
      setErrorMessage('Failed to verify email. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-black rounded-lg p-6 w-full max-w-md relative border border-green">
        <h2 className="text-2xl font-bold mb-4 text-green text-center">
          {step === 'email' ? 'Access Presale' : 'Verify Email'}
        </h2>
        <button 
          className="absolute top-4 right-4 text-green hover:text-white"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {errorMessage && <p className="text-red-500 mb-4 text-center">{errorMessage}</p>}
        {!publicKey ? (
          <div className="text-center">
            <p className="text-white mb-4">Please connect your wallet to access the presale.</p>
            <WalletMultiButton className="bg-green text-black px-6 py-2 rounded hover:bg-opacity-80 transition-colors" />
          </div>
        ) : step === 'email' ? (
          <form onSubmit={handleSubmitEmail} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2 bg-gray-800 text-white rounded border border-green focus:outline-none focus:ring-2 focus:ring-green"
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                id="agree"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                required
                className="mr-2"
              />
              <label htmlFor="agree" className="text-sm text-gray-300">
                I agree to the{' '}
                <button type="button" onClick={() => setShowTermsOfService(true)} className="text-green hover:underline">
                  Terms of Service
                </button>{' '}
                and{' '}
                <button type="button" onClick={() => setShowPrivacyPolicy(true)} className="text-green hover:underline">
                  Privacy Policy
                </button>
              </label>
            </div>
            <div className="flex justify-center">
              <button type="submit" className="bg-green text-black px-6 py-2 rounded hover:bg-opacity-80 transition-colors">
                Submit
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <input
              type="text"
              placeholder="Verification Code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              className="w-full p-2 bg-gray-800 text-white rounded border border-green focus:outline-none focus:ring-2 focus:ring-green"
            />
            <div className="flex justify-center">
              <button type="submit" className="bg-green text-black px-6 py-2 rounded hover:bg-opacity-80 transition-colors">
                Verify Email
              </button>
            </div>
          </form>
        )}
      </div>
      {showPrivacyPolicy && (
        <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} />
      )}
      {showTermsOfService && (
        <TermsOfService onClose={() => setShowTermsOfService(false)} />
      )}
    </div>
  );
};

export default PresaleAccessOverlay;