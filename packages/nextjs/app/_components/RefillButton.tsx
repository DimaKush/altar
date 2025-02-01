"use client";

import { useState } from "react";
import { RefillForm } from "./RefillForm";

export const RefillButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        className="btn btn-primary" 
        onClick={() => setIsOpen(true)}
      >
        Refill
      </button>

      {isOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Refill TORCH</h3>
            <RefillForm />
            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}; 