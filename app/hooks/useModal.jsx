import { useState, useCallback } from 'react';
import { Modal, TextField, FormLayout, Form } from "@shopify/polaris";

export const useModal = (initialProduct) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(initialProduct);

    const onOpen = useCallback((product) => {
        setCurrentProduct(product || initialProduct);
        setIsOpen(true);
    }, [initialProduct]);

    const onClose = useCallback(() => {
        setCurrentProduct(initialProduct);
        setIsOpen(false);
    }, [initialProduct]);

    const handleChange = useCallback((field) => (value) => {
        setCurrentProduct(prev => ({ ...prev, [field]: value }));
    }, []);

    const ModalDialog = useCallback(({ title, submit }) => {
        const handleAction = () => {
            try {
                console.log(currentProduct)
                switch (title) {
                    case 'add':
                        submit({
                            _action: 'create',
                            ...currentProduct
                        }, { method: 'post' });
                        break;
                    case 'edit':
                        submit({
                            _action: 'edit',
                            productId: currentProduct.id,
                            ...currentProduct
                        }, { method: 'put' });
                        break;
                    case 'delete':
                        submit({
                            _action: 'delete',
                            productId: currentProduct.id,
                        }, { method: 'delete' });
                        break;
                    default:
                        break;
                }
            } catch (error) {
                console.log(error);
            } finally {
                onClose();
            }
        };

        return (
            <Modal 
                open={isOpen} 
                onClose={onClose} 
                title={title}
                primaryAction={{ content: 'Submit', onAction: handleAction }}
            >
                <Modal.Section>
                    <Form onSubmit={(e) => e.preventDefault()}>
                        <FormLayout>
                            <TextField
                                label="Title"
                                value={currentProduct.title}
                                onChange={handleChange('title')}
                                disabled={title === 'delete'}
                            />
                            <TextField
                                label="Description"
                                value={currentProduct.description}
                                onChange={handleChange('description')}
                                disabled={title === 'delete'}
                            />
                            <TextField
                                label="Price"
                                value={currentProduct.price}
                                onChange={handleChange('price')}
                                type="number"
                                disabled={title === 'delete'}
                            />
                            <TextField
                                label="Vendor"
                                value={currentProduct.vendor}
                                onChange={handleChange('vendor')}
                                disabled={title === 'delete'}
                            />
                        </FormLayout>
                    </Form>
                </Modal.Section>
            </Modal>
        );
    }, [isOpen, currentProduct, onClose, handleChange]);

    return {
        ModalDialog,
        onOpen,
        onClose,
        currentProduct,
    };
};