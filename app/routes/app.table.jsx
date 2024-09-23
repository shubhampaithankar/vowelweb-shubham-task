import { json } from '@remix-run/node'
import { useCallback, useEffect, useState } from 'react'
import { Page, Layout, Card, DataTable, Button, BlockStack, Modal, Form, FormLayout, TextField, DropZone, Thumbnail, Banner, List, Text } from '@shopify/polaris'
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
                        id
                        price
                    }
                }
              }
              media(first: 1) {
                edges {
                    node {
                        id
                        alt
                        mediaContentType
                        preview {
                            image {
                                url
                                id
                            }
                        }
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
        const productId = formData.get('productId')
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
        const title = formData.get('title')
        const description = formData.get('description')
        const price = formData.get('price')
        const vendor = formData.get('vendor')
        const image = formData.get('image')

        const createProductWithNewMedia = await admin.graphql(`
        #graphql
            mutation CreateProductWithNewMedia($input: ProductInput!, $media: [CreateMediaInput!]) {
              productCreate(input: $input, media: $media) {
                product {
                  id
                  title
                  media(first: 10) {
                    nodes {
                      alt
                      mediaContentType
                      preview {
                        status
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                input: {
                  title,
                  descriptionHtml: description,
                  vendor,
                },
                media: [
                  {
                    originalSource: image,
                    alt: `${title}-alt-image`,
                    mediaContentType: "IMAGE"
                  },
                ]
              },
        })

        const createProductWithNewMediaJson = await createProductWithNewMedia.json()
        const productId = createProductWithNewMediaJson.data.productCreate.product.id

        await admin.graphql(
          `#graphql
          `
        )

        return json({ success: true, actionType })
    }

    if (actionType === 'edit') {
        const id = formData.get('id')
        const title = formData.get('title')
        const description = formData.get('description')
        const vendor = formData.get('vendor')
        const price = formData.get('price')
        const image = formData.get('image')
    
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
        vendor: '',
        price: '',
        media: ''
    });
    const [files, setFiles] = useState([])

    const addProduct = useCallback(() => {
        setIsOpen(true)
        setTitle('add')
    }, [])

    const editProduct = useCallback((product) => {
        console.log(`product: `, product)
        setIsOpen(true)
        setTitle('edit')
        setCurrentProduct({
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.variants.edges[0].node.price,
            vendor: product.vendor,
            media: product.media?.edges[0]?.node?.alt || ''
        })
        setFiles([])
    }, [])

    const deleteProduct = useCallback((product) => {
        setIsOpen(true)
        setTitle('delete')
        setCurrentProduct(product)
    }, [])

    const onClose = useCallback(() => {
        setCurrentProduct({
            id: '',
            title: '',
            description: '',
            price: '',
            vendor: '',
        });
        setTitle('')
        setFiles([])
        setIsOpen(false);
    }, [])

    const handleChange = useCallback((value, key) => {
        console.log(`value: ${value}, key: ${key}`)
        setCurrentProduct({ ...currentProduct, [key]: value })
    }, [currentProduct])

    const handleAction = () => {
        const src = files[0] ? URL.createObjectURL(files[0]) : ''
        try {
            console.log(files)
            switch (title) {
                case 'add':
                    submit({
                        _action: 'create',
                        ...currentProduct,
                        image: src
                    }, { method: 'post' });
                    break;
                case 'edit':
                    submit({
                        _action: 'edit',
                        productId: currentProduct.id,
                        ...currentProduct,
                        // image: files[0] ? URL.createObjectURL(files[0]) : currentProduct.media ? currentProduct.image : ''
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
            URL.revokeObjectURL(src)
        }
    };

    const rows = products.map((product) => [
        product.title,
        product.description,
        <img src={product.media?.edges[0]?.src} alt={product.title} width="50" key={product.id} />,
        `$${product.variants?.edges[0]?.node?.price || 0}`,
        product.vendor,
        <FetcherForm method="post" key={product.id}>
            <input type="hidden" name="productId" value={product.id} />
            <Button type="submit" name="_action" value="edit" onClick={() => editProduct(product)} disabled={loading}>Edit</Button>
            <Button type="submit" name="_action" value="delete" onClick={() => deleteProduct(product)} disabled={loading}>Delete</Button>
        </FetcherForm>
    ])

    console.log(products)

    useEffect(() => {
        return () => {
            files.forEach(file => URL.revokeObjectURL(file));
        }
    })

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
                            <TextField label="Title" name="title" value={currentProduct.title} disabled={title === 'delete'} onChange={(event) => handleChange(event, 'title')} />
                            <TextField label="Description" name="description" value={currentProduct.description} disabled={title === 'delete'} onChange={(event) => handleChange(event, 'description')}/>
                            <TextField label="Price" type="number" name="price" value={currentProduct.price} disabled={title === 'delete'} onChange={(event) => handleChange(event, 'price')} />
                            <TextField label="Vendor" name="vendor" value={currentProduct.vendor} disabled={title === 'delete'} onChange={(event) => handleChange(event, 'vendor')} />
                            <DropZoneWithImageFileUpload files={files} setFiles={setFiles} disabled={title === 'delete'}/>
                        </Form>
                    </FormLayout>
                </Modal.Section>    
            </Modal>
        </Page>
    )
}

function DropZoneWithImageFileUpload({ files, setFiles, disabled }) {
    const [rejectedFiles, setRejectedFiles] = useState([]);
    const hasError = rejectedFiles.length > 0;
  
    const handleDrop = useCallback(
      (_droppedFiles, acceptedFiles, rejectedFiles) => {
        setFiles((files) => [...files, ...acceptedFiles]);
        setRejectedFiles(rejectedFiles);
      },
      [],
    );
  
    const fileUpload = !files.length && <DropZone.FileUpload />;
    const uploadedFiles = files.length > 0 && (
      <BlockStack vertical>
        {files.map((file, index) => (
          <BlockStack alignment="center" key={index}>
            <Thumbnail
              size="small"
              alt={file.name}
              source={window.URL.createObjectURL(file)}
            />
            <div>
              {file.name}{' '}
              <Text variant="bodySm" as="p">
                {file.size} bytes
              </Text>
            </div>
          </BlockStack>
        ))}
      </BlockStack>
    );
  
    const errorMessage = hasError && (
      <Banner title="The following images couldn’t be uploaded:" tone="critical">
        <List type="bullet">
          {rejectedFiles.map((file, index) => (
            <List.Item key={index}>
              {`"${file.name}" is not supported. File type must be .gif, .jpg, .png or .svg.`}
            </List.Item>
          ))}
        </List>
      </Banner>
    );
  
    return (
      <BlockStack vertical={true}>
        {errorMessage}
        <DropZone accept="image/*" type="image" onDrop={handleDrop} disabled={disabled} label="Images">
          {uploadedFiles}
          {fileUpload}
        </DropZone>
      </BlockStack>
    );
}
  