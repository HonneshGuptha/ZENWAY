import React from 'react';
import QRCode from 'react-qr-code';

interface UPIPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payeeUpi: string;
  payeeName: string;
  amount: number;
  txId: string;
}

export const UPIPaymentModal: React.FC<UPIPaymentModalProps> = ({
  isOpen,
  onClose,
  payeeUpi,
  payeeName,
  amount,
  txId,
}) => {
  if (!isOpen) return null;

  const upiString = `upi://pay?pa=${payeeUpi}&pn=${payeeName}&am=${amount}&tn=ZENWAY-${txId}&cu=INR`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl flex flex-col items-center text-center">
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          ₹{amount}
        </h2>
        <p className="text-sm text-gray-500 mb-5">Scan with any UPI app</p>

        <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-6 flex items-center justify-center">
          <QRCode value={upiString} size={256} />
        </div>

        <button
          onClick={onClose}
          type="button"
          className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default UPIPaymentModal;
