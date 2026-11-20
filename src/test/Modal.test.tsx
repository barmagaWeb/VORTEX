import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../components/ui/Modal';
import { LanguageProvider } from '../context/LanguageContext';

const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Edit profile"
        footer={<button>Save</button>}
      >
        <input aria-label="Name" />
      </Modal>
    </>
  );
};

const openModal = () => {
  render(
    <LanguageProvider>
      <Harness />
    </LanguageProvider>,
  );
  const opener = screen.getByText('Open');
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('Modal accessibility', () => {
  it('labels the dialog by its title via aria-labelledby', () => {
    openModal();
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent('Edit profile');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog on open (first field, not the close button)', () => {
    openModal();
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('wraps Tab from the last focusable element to the first', () => {
    openModal();
    const save = screen.getByText('Save');
    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(screen.getByLabelText('Close dialog')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    openModal();
    const close = screen.getByLabelText('Close dialog');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Save')).toHaveFocus();
  });

  it('closes on Escape and restores focus to the opener', () => {
    const opener = openModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
