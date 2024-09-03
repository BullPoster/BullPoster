import React from 'react';

const PrivacyPolicy = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-black rounded-lg p-6 w-full max-w-4xl h-5/6 overflow-y-auto relative border border-green">
        <h2 className="text-3xl font-bold mb-6 text-green">Privacy Policy</h2>
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
          <p className="text-lg">BullPoster ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website BullPoster.xyz, including any other media form, media channel, mobile website, or mobile application related or connected thereto (collectively, the "Site"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Site.</p>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">1. Information We Collect</h3>
            <h4 className="text-xl font-medium mb-2">Personal Data:</h4>
            <p>We collect personally identifiable information that you voluntarily provide to us when you register on the Site, express an interest in obtaining information about us or our products and services, when you participate in activities on the Site, or otherwise when you contact us. This includes:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>Email address</li>
              <li>Password</li>
              <li>Any other information you choose to provide</li>
            </ul>
            
            <h4 className="text-xl font-medium mt-4 mb-2">Non-Personal Data:</h4>
            <p>We also collect information automatically as you navigate through the Site. This includes:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Operating system</li>
              <li>Access times</li>
              <li>Pages viewed directly before and after accessing the Site</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">2. Use of Your Information</h3>
            <p>We use the information we collect in the following ways:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>To operate and maintain the Site</li>
              <li>To improve your experience on our Site</li>
              <li>To send administrative information to you, such as security or support and maintenance advisories</li>
              <li>To respond to your inquiries and fulfill your requests</li>
              <li>To send you marketing and promotional communications</li>
              <li>To enforce our terms, conditions, and policies for business purposes</li>
              <li>To protect against and prevent fraud, unauthorized transactions, claims, and other liabilities</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">3. Disclosure of Your Information</h3>
            <p>We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
              <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
              <li><strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">4. Security of Your Information</h3>
            <p>We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.</p>
          </section>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">5. Policy for Children</h3>
            <p>We do not knowingly solicit information from or market to children under the age of 13. If we learn that we have collected information from a child under age 13 without verification of parental consent, we will delete that information as quickly as possible.</p>
          </section>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">6. Changes to This Privacy Policy</h3>
            <p>We may update this Privacy Policy from time to time in order to reflect, for example, changes to our practices or for other operational, legal, or regulatory reasons. We will notify you of any changes by posting the new Privacy Policy on the Site and updating the "Effective Date" at the top of this Privacy Policy.</p>
          </section>
          
          <section>
            <h3 className="text-2xl font-semibold text-green mb-4">7. Contact Us</h3>
            <p>If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:admin@BullPoster.xyz" className="text-green hover:underline">admin@BullPoster.xyz</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;