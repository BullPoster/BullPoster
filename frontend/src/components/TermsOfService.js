import React from 'react';

const TermsOfService = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-black rounded-lg p-6 w-full max-w-4xl h-5/6 overflow-y-auto relative border border-green">
        <h2 className="text-3xl font-bold mb-6 text-green">Terms of Service</h2>
        <button 
          className="absolute top-4 right-4 text-green hover:text-white transition-colors duration-200"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-left text-white space-y-6">
          <p className="text-sm text-gray-400">Effective Date: 09/02/2024</p>
          <p className="text-lg">BullPoster ("we," "our," or "us") provides the BullPoster platform, including our website BullPoster.xyz and related services (collectively, the "Services"). These Terms of Service ("Terms") govern your access to and use of the Services. By accessing or using the Services, you agree to be bound by these Terms.</p>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">1. Use of Our Services</h3>
            <h4 className="text-xl font-medium mb-2">Eligibility:</h4>
            <p>You must be at least 18 years old to use our Services. By using the Services, you represent and warrant that you have the legal capacity to enter into a binding contract with us and meet all of the foregoing eligibility requirements.</p>

            <h4 className="text-xl font-medium mt-4 mb-2">Registration:</h4>
            <p>To access certain features of the Services, you may be required to register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and any activities or actions under your account.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">2. User Conduct</h3>
            <p>You agree not to use the Services for any purpose that is unlawful or prohibited by these Terms. You agree not to:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>Use the Services in any manner that could disable, overburden, damage, or impair the Services</li>
              <li>Use any robot, spider, or other automatic device, process, or means to access the Services for any purpose</li>
              <li>Use the Services to distribute unsolicited promotional or commercial content</li>
              <li>Attempt to gain unauthorized access to, interfere with, damage, or disrupt any parts of the Services or any server, computer, or database connected to the Services</li>
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">3. KYC Compliance</h3>
            <p>You acknowledge that participation in our Initial Token Offering (ITO) requires compliance with KYC (Know Your Customer) regulations. You will be required to provide identification and other relevant information to verify your eligibility to participate. Failure to provide such information may result in the inability to participate in the ITO.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">4. User Responsibility</h3>
            <p>It is your responsibility to ensure that you are legally allowed to participate in the ITO based on your local laws and regulations. BullPoster is not liable for any legal consequences that arise from your participation in the ITO without proper due diligence. If you have participated in the ITO and it is deemed that your participation is not legally acceptable due to negligence on your part, you will not receive any BullPoster Tokens at the time of distribution.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">5. Restricted Countries</h3>
            <p>Residents of the following countries are not permitted to participate in the ITO: Cuba, Syria, Venezuela, Iran, North Korea, Russia. Any participation from these countries is strictly prohibited and will result in disqualification from receiving BullPoster Tokens.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">6. Unique Address Assignment</h3>
            <p>Each user is assigned a unique Solana address upon registration. This address should not be shared with others. You are solely responsible for maintaining the confidentiality and security of your unique address and any activities that occur under your address.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">7. Intellectual Property</h3>
            <p>The Services and their entire contents, features, and functionality are owned by BullPoster, its licensors, or other providers of such material and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws as applicable.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">8. Limitation of Liability</h3>
            <p>To the fullest extent permitted by applicable law, in no event shall BullPoster, its affiliates, directors, employees, or agents be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages, including without limitation damages for loss of profits, goodwill, use, data, or other intangible losses, arising out of or relating to your use of the Services.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">9. Governing Law</h3>
            <p>These Terms are governed by and construed in accordance with the laws of St Kitts and Nevis, without regard to its conflict of law principles. You agree to submit to the exclusive jurisdiction of the courts located within St Kitts and Nevis to resolve any legal matter arising from these Terms.</p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">10. Changes to These Terms</h3>
            <p>We may update these Terms from time to time in order to reflect, for example, changes to our practices or for other operational, legal, or regulatory reasons. We will notify you of any changes by posting the new Terms on the Site and updating the "Effective Date" at the top of these Terms.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;