import { useState } from 'react';
import { Modal, TextField, FormLayout, Form } from "@shopify/polaris";

export const useModal = (initialProduct = {}, modalData) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    title: initialProduct.title || '',
    description: initialProduct.description || '',
    price: initialProduct.price || '',
    vendor: initialProduct.vendor || ''
  });

  const onClose = () => {
    setIsOpen(false)
    setCurrentProduct({
        title: '',
        description: '',
        price: '',
        vendor: ''
    })
  }

  const handleChange = (field) => (value) => setCurrentProduct(prev => ({ ...prev, [field]: value }));

  const ModalDialog = () => {
    return (
      <Modal
        open={isOpen}
        onClose={onClose}
        title={modalData.title}
        primaryAction={modalData.action}
      >
        <Modal.Section>
          <Form onSubmit={(e) => e.preventDefault()}>
            <FormLayout>
              <TextField
                label="Title"
                value={currentProduct.title}
                onChange={handleChange('title')}
              />
              <TextField
                label="Description"
                value={currentProduct.description}
                onChange={handleChange('description')}
              />
              <TextField
                label="Price"
                value={currentProduct.price}
                onChange={handleChange('price')}
                type="number"
              />
              <TextField
                label="Vendor"
                value={currentProduct.vendor}
                onChange={handleChange('vendor')}
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    );
  };

  return {
    ModalDialog,
    isOpen
  };
};