import { json } from '@remix-run/node'
import { useCallback, useState } from 'react'
import { Page, Layout, Card, DataTable, Button, Toast, Modal, Form, FormLayout, TextField } from '@shopify/polaris'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { authenticate } from "../shopify.server"

// inital popupulate data // get data from graphql
export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request)
    const response = await admin.graphql(`
    {
        products(first: 10) {
          edges {
            node {
              id
              title
              description
              vendor
              variants(first: 1) {
                edges {
                    node {
                        price
                    }
                }
              }
              images(first: 1) {
                edges {
                  node {
                    src
                  }
                }
              }
            }
          }
        }
      }
    `)
    const responseJson = await response.json()
    const products = responseJson.data.products.edges.map((edge) => edge.node)
    return json({ products })
}
// create, edit, delete products // post, put, delete products
export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request)
    const formData = await request.formData()
    const actionType = formData.get('_action')

    if (actionType === 'delete') {
        const productId = formData.get('productId');
        await admin.graphql(`
        #graphql
          mutation DeleteProduct($input: ProductDeleteInput!) {
            productDelete(input: $input) {
              deletedProductId
            }
          }`,
          {
            variables: {
              input: { id: productId },
            },
          }
        )
        
        return json({ success: true, actionType })
    }

    if (actionType === 'create') {
        const title = formData.get('title');
        const description = formData.get('description');
        const price = formData.get('price');
        const vendor = formData.get('vendor');

        await admin.graphql(`
        #graphql
            mutation populateProduct($input: ProductInput!) {
                productCreate(input: $input) {
                    product {
                        id
                        description,
                        vendor,
                        title,
                        variants(first: 10) {
                            edges {
                                node {
                                    price
                                }
                            }
                        }
                    }
                }
            }`,
            {
                variables: {
                    input: {
                        title,
                        vendor,
                    },
                    // variants: [{ price, description }],
                    // images: [{ src }],
                },
            },
        )
        
        return json({ success: true, actionType })
    }

    if (actionType === 'edit') {
        const id = formData.get('productId');
        const title = formData.get('title');
        const description = formData.get('description');
        const price = formData.get('price');
        const vendor = formData.get('vendor');

        await admin.graphql(`
        #graphql
            mutation populateProduct($input: ProductInput!) {
                productUpdate(input: $input) {
                    product {
                        id
                    }
                }
            }`,
            {
                variables: {
                    input: {
                        id,
                        title,
                        vendor,
                    },
                    variants: [{ price, description }],

            },
            })
            return json({ success: true, actionType })
    }

    return json({ error: "Unsupported action" })
}

export default function TablePage() {
    const { state, Form: FetcherForm, submit } = useFetcher()
    const loading = state === 'loading'

    const { products } = useLoaderData()

    const [title, setTitle] = useState('')
    const [isOpen, setIsOpen] = useState(false);
    const [currentProduct, setCurrentProduct] = useState({
        id: '',
        title: '',
        description: '',
        price: '',
        vendor: '',
    });

    const addProduct = useCallback(() => {
        setIsOpen(true)
        setTitle('add')
    }, [])

    const editProduct = useCallback(() => {
        setIsOpen(true)
        setTitle('edit')
    }, [])

    const deleteProduct = useCallback(() => {
        setIsOpen(true)
        setTitle('delete')
    }, [])

    const onClose = useCallback(() => {
        setCurrentProduct({
            id: '',
            title: '',
            description: '',
            price: '',
            vendor: '',
        });
        setIsOpen(false);
    }, [])

    const handleChange = useCallback((value, key) => setCurrentProduct({ ...currentProduct, [key]: value }), [currentProduct])

    const handleAction = () => {
        try {
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

    const rows = products.map((product) => [
        product.title,
        product.description,
        <img src={product.images?.[0]?.src} alt={product.title} width="50" key={product.id} />,
        `$${product.variants[0]?.price || 0}`,
        product.vendor,
        <FetcherForm method="post" key={product.id}>
            <input type="hidden" name="productId" value={product.id} />
            <Button type="submit" name="_action" value="edit" onClick={() => editProduct(product)} disabled={loading}>Edit</Button>
            <Button type="submit" name="_action" value="delete" onClick={() => deleteProduct(product)} disabled={loading}>Delete</Button>
        </FetcherForm>
    ])

    return (
        <Page title="Table Page">
            <Layout>
                <Layout.Section>
                <Card>
                    <Button primary onClick={addProduct} disabled={loading}>Add new product</Button>
                    <DataTable
                        columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                        headings={['Title', 'Description', 'Image', 'Price', 'Vendor', 'Actions']}
                        rows={rows}
                    />
                </Card>
                </Layout.Section>
            </Layout>
            <Modal
                open={isOpen}
                onClose={onClose} 
                title={title}
                primaryAction={{ content: 'Submit', onAction: handleAction }}
            >
                <Modal.Section>
                    <FormLayout>
                        <Form onSubmit={submit}>
                            <TextField label="Title" name="title" value={currentProduct.title} disabled={loading} onChange={(event) => handleChange(event, 'title')} />
                            <TextField label="Description" name="description" value={currentProduct.description} disabled={loading} onChange={(event) => handleChange(event, 'description')}/>
                            <TextField label="Price" type="number" name="price" value={currentProduct.price} disabled={loading} onChange={(event) => handleChange(event, 'price')} />
                            <TextField label="Vendor" name="vendor" value={currentProduct.vendor} disabled={loading} onChange={(event) => handleChange(event, 'vendor')} />
                        </Form>
                    </FormLayout>
                </Modal.Section>    
            </Modal>
        </Page>
    )
}