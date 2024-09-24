// fix image not loading, and add variants when creating product

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
  try {
    const { admin } = await authenticate.admin(request)
    const formData = await request.formData()
    const actionType = formData.get('_action')
    const product = JSON.parse(formData.get('product')|| '')
    const file = formData.get('file')

    if (!product) return ({ success: false, error: 'Product not found', actionType })
    
    const id = product.id || null

    const title = product.title
    const description = product.description
    const vendor = product.vendor

    const priceId = product.variants?.edges[0]?.node?.id
    const price = product.variants?.edges[0]?.node?.price

    // const url = URL.createObjectURL(file)

    const imageId = product.media?.edges[0]?.node?.id
    // const imageURL = product.media?.edges[0]?.node?.preview?.image?.url
    const imageURL = 'https://cdn.shopify.com/s/files/1/0600/8035/7460/files/200_e1df0bb0-c3ea-4978-8c13-ef648cfb92fb.jpg?v=1727094117'
    const alt = `${title}-image-alt`

    if (actionType === 'delete') {
        await admin.graphql(`
        #graphql
          mutation DeleteProduct($input: ProductDeleteInput!) {
            productDelete(input: $input) {
              deletedProductId
            }
          }`,
          {
            variables: {
              input: { id },
            },
          }
        )
        
        return json({ success: true, actionType })
    }

    if (actionType === 'create') {
      await admin.graphql(`
        mutation CreateProductWithNewMedia($input: ProductInput!, $media: [CreateMediaInput!]) {
          productCreate(input: $input, media: $media) {
            product {
              id
              title
              descriptionHtml
              vendor
              media(first: 10) {
                nodes {
                  alt
                  mediaContentType
                  preview {
                    status
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }  
      `, {
        variables: {
          input: {
            title,
            descriptionHtml: description,
            vendor
          },
          media: [
            {
              originalSource: imageURL,
              alt,
              mediaContentType: "IMAGE"
            }
          ]
        }
      })
      .then((response) => response.json())
      .then((async ({ data }) => {
        const product = data?.productCreate.product
        const newPriceId = product.variants?.edges[0]?.node?.id

        // update price
        await admin.graphql(
          `
            mutation UpdateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                product {
                  id
                }
                productVariants {
                  price
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              productId: product.id,
              variants: [
                {
                  id: newPriceId,
                  price
                }
              ]
            }
          }
        )}))

      return json({ success: true, actionType })

    }

    if (actionType === 'edit') {

      // update data and media
      await admin.graphql(
        `
        mutation UpdateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
          productUpdate(input: $input, media: $media) {
            product {
              id
              title
              descriptionHtml
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
        }  
      `, {
        variables: {
          input: {
            id,
            title,
            descriptionHtml: description,
          },
          media: [
            {
              originalSource: imageURL,
              alt,
              mediaContentType: "IMAGE"
            }
          ]
        }
      })

      // update price
      await admin.graphql(
        `
          mutation UpdateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              product {
                id
              }
              productVariants {
                price
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            productId: id,
            variants: [
              {
                id: priceId,
                price
              }
            ]
          }
        }
      )

      return json({ success: true, actionType })
    }

    return json({ error: "Unsupported action" })
  } catch (error) {
    return json({ error })
  }
}

export default function TablePage() {
    const { state, Form: FetcherForm, submit } = useFetcher()
    const loading = state === 'loading'
  
    const { products } = useLoaderData()
    console.log(products)
  
    const [title, setTitle] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [currentProduct, setCurrentProduct] = useState(null)
    const [files, setFiles] = useState([])
  
    const addProduct = useCallback(() => {
      setIsOpen(true)
      setTitle('add')
      setCurrentProduct({
        id: '',
        title: '',
        description: '',
        vendor: '',
        variants: { edges: [{ node: { price: '' } }] },
        media: { edges: [{ node: { preview: { image: { url: '' } } } }] },
      })
    }, [])
  
    const editProduct = useCallback((product) => {
      setIsOpen(true)
      setTitle('edit')
      setCurrentProduct(product)
      setFiles([])
    }, [])
  
    const deleteProduct = useCallback((product) => {
      setIsOpen(true)
      setTitle('delete')
      setCurrentProduct(product)
    }, [])
  
    const onClose = useCallback(() => {
      setCurrentProduct(null)
      setTitle('')
      setFiles([])
      setIsOpen(false)
    }, [])
  
    const handleChange = useCallback((value, key) => {
      setCurrentProduct((prevProduct) => {
        const updatedProduct = { ...prevProduct }
  
        if (key === 'price' && updatedProduct.variants?.edges.length > 0) {
          updatedProduct.variants.edges[0].node.price = value
        } else if (key in updatedProduct) {
          updatedProduct[key] = value
        }
  
        return updatedProduct
      })
    }, [])
  
    // Handle actions for add/edit/delete products
    const handleAction = () => {
      const src = files[0] ? URL.createObjectURL(files[0]) : ''
      const formData = new FormData()
      const blob = new Blob
      try {
        switch (title) {
          case 'add': {
              const product = JSON.stringify({
                  ...currentProduct,
                  media: {
                      edges: [
                        {
                          node: {
                            preview: {
                              image: { url: src }
                            }
                          }
                        }
                      ]
                  }
              })

              formData.append('_action', 'create')
              formData.append('product', product)
              formData.append('file', files.length > 0 ? files[0] : null)
              submit(formData ,{ method: 'post' })
              break
          }
          case 'edit': {
              const product = JSON.stringify({
                  ...currentProduct,
                  media: {
                      edges: [
                        {
                          node: {
                            preview: {
                              image: { url: src || currentProduct.media?.edges[0]?.node?.preview?.image?.url }
                            }
                          }
                        }
                      ]
                  }
              })
              submit(
                {
                  _action: 'edit',
                  product: product
                },
                { method: 'put' }
              )
              break
          }
          case 'delete':
            submit(
              {
                _action: 'delete',
                product: JSON.stringify(currentProduct),
              },
              { method: 'delete' }
            )
            break
          default:
            break
        }
      } catch (error) {
        console.log(error)
      } finally {
        onClose()
        URL.revokeObjectURL(src)
      }
    }
  
    const rows = products.map((product) => [
      product.title,
      product.description,
      <img
        src={product.media?.edges[0]?.node?.preview?.image?.url || ''}
        alt={product.title}
        width="50"
        key={product.id}
      />,
      `$${product.variants?.edges[0]?.node?.price || 0}`,
      product.vendor,
      <FetcherForm method="post" key={product.id}>
        <input type="hidden" name="productId" value={product.id} />
        <Button
          type="submit"
          name="_action"
          value="edit"
          onClick={() => editProduct(product)}
          disabled={loading}
        >
          Edit
        </Button>
        <Button
          type="submit"
          name="_action"
          value="delete"
          onClick={() => deleteProduct(product)}
          disabled={loading}
        >
          Delete
        </Button>
      </FetcherForm>,
    ])
  
    useEffect(() => {
      return () => {
        files.forEach((file) => URL.revokeObjectURL(file))
      }
    }, [files])
  
    return (
      <Page title="Table Page">
        <Layout>
          <Layout.Section>
            <Card>
              <Button primary onClick={addProduct} disabled={loading}>
                Add new product
              </Button>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                headings={['Title', 'Description', 'Image', 'Price', 'Vendor', 'Actions']}
                stickyHeader={true}
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
                <TextField
                  label="Title"
                  name="title"
                  value={currentProduct?.title || ''}
                  disabled={title === 'delete'}
                  onChange={(event) => handleChange(event, 'title')}
                />
                <TextField
                  label="Description"
                  name="description"
                  value={currentProduct?.description || ''}
                  disabled={title === 'delete'}
                  onChange={(event) => handleChange(event, 'description')}
                />
                <TextField
                  label="Price"
                  type="number"
                  name="price"
                  value={currentProduct?.variants?.edges[0]?.node?.price || ''}
                  disabled={title === 'delete'}
                  onChange={(event) => handleChange(event, 'price')}
                />
                <TextField
                  label="Vendor"
                  name="vendor"
                  value={currentProduct?.vendor || ''}
                  disabled={title === 'delete'}
                  onChange={(event) => handleChange(event, 'vendor')}
                />
                <DropZoneWithImageFileUpload
                  files={files}
                  setFiles={setFiles}
                  disabled={title === 'delete'}
                  image={currentProduct?.media?.edges[0]?.node?.preview?.image?.url || ''}
                />
              </Form>
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Page>
    )
}

function DropZoneWithImageFileUpload({ files, setFiles, disabled, image }) {
  const [rejectedFiles, setRejectedFiles] = useState([]);
  const [isImageValid, setIsImageValid] = useState(true); // Track validity of the image URL
  const hasError = rejectedFiles.length > 0;

  const handleDrop = useCallback(
    (_droppedFiles, acceptedFiles, rejectedFiles) => {
      // Replace the files array with the newly uploaded file
      setFiles([...acceptedFiles]);
      setRejectedFiles(rejectedFiles);
    },
    [setFiles],
  );

  // Use the new file for display if available, otherwise fallback to the passed image prop
  const displayFiles = files.length > 0
    ? files
    : image
    ? [{ name: 'Uploaded image', size: 0, source: image }]
    : [];

  // Check if the image URL is valid
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.onload = () => setIsImageValid(true);
      img.onerror = () => setIsImageValid(false);
      img.src = image;
    }
  }, [image]);

  const fileUpload = !files.length && !image && <DropZone.FileUpload />;

  const uploadedFiles = displayFiles.length > 0 && (
    <BlockStack vertical={"true"}>
      {displayFiles.map((file, index) => (
        <BlockStack alignment="center" key={index}>
          {isImageValid || file.source ? (
            <Thumbnail
              size="small"
              alt={file.name}
              source={file.source || window.URL.createObjectURL(file)}
            />
          ) : (
            <div>Invalid image URL</div> // Display an error message for invalid URLs
          )}
          <div>
            {file.name}{' '}
            <Text variant="bodySm" as="p">
              {file.size ? `${file.size} bytes` : 'From URL'}
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
    <BlockStack vertical={"true"}>
      {errorMessage}
      <DropZone accept="image/*" type="image" onDrop={handleDrop} disabled={disabled} label="Images">
        {uploadedFiles}
        {fileUpload}
      </DropZone>
    </BlockStack>
  );
}