import { json } from '@remix-run/node'
import { useCallback, useEffect, useState } from 'react'
import { Page, Layout, Card, DataTable, Button, BlockStack, Modal, Form, FormLayout, TextField, DropZone, Thumbnail, Banner, List, Text } from '@shopify/polaris'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { authenticate } from "../shopify.server"

// Helper function for making GraphQL requests
const graphqlRequest = async (admin, query, variables) => {
  try {
    const response = await admin.graphql(query, { variables })
    return response.json()
  } catch (error) {
    console.error('GraphQL Error:', error)
    throw new Error('Failed to execute GraphQL request')
  }
}

// inital popupulate data // get data from graphql
export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request)
    const query = `
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
                    preview {
                      image {
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    const responseJson = await graphqlRequest(admin, query)
    const products = responseJson.data.products.edges.map((edge) => edge.node)
    return json({ products, success: true })
  } catch (error) {
    return json({ error, success: false })
  }

}
// create, edit, delete products // post, put, delete products
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request)
  const formData = await request.formData()
  const actionType = formData.get('_action')
  const productData = JSON.parse(formData.get('product') || '')

  if (!productData) return json({ success: false, error: 'Product not found', actionType })

  const { id, title, description, vendor, variants, media } = productData
  const priceId = variants?.edges[0]?.node?.id
  const price = variants?.edges[0]?.node?.price
  const imageURL = media?.edges[0]?.node?.preview?.image?.url
  const alt = `${title}-image-alt`
  
  try {
    switch (actionType) {
      case 'delete': {
        await graphqlRequest(admin, `
          mutation DeleteProduct($input: ProductDeleteInput!) {
            productDelete(input: $input) {
              deletedProductId
            }
          }
        `, { input: { id } })
        return json({ success: true, actionType })
      }

      case 'create': {
        const response = await graphqlRequest(admin, `
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
          input: { title, descriptionHtml: description, vendor },
          media: [{ originalSource: imageURL, alt, mediaContentType: 'IMAGE' }]
        })
        const product = response.data.productCreate?.product
        if (product && price) {
          const priceId = product.variants.edges[0].node.id
          await graphqlRequest(admin, `
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
            productId: product.id,
            variants: [{ id: priceId, price }]
          })
        }
        return json({ success: true, actionType, product })
      }

      case 'edit': {
        await graphqlRequest(admin, `
          mutation UpdateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
            productUpdate(input: $input, media: $media) {
              product {
                id
              }
            }
          }
        `, {
          input: { id, title, descriptionHtml: description, vendor },
          media: [{ originalSource: imageURL, alt, mediaContentType: 'IMAGE' }]
        })

        // Update price
        await graphqlRequest(admin, `
          mutation UpdateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                price
              }
            }
          }
        `, {
          productId: id,
          variants: [{ id: priceId, price }]
        })
        return json({ success: true, actionType })
      }
        
      default: json({ success: false, error: 'Unsupported action', actionType })
    }
  } catch (error) {
    return json({ success: false, error: JSON.stringify(error), actionType })
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
      const src = files[0] ? URL.createObjectURL(files[0]) : null
      const formData = new FormData()
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
              submit(formData, { method: 'post' })
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
              formData.append('_action', 'edit')
              formData.append('product', product)
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
  const [rejectedFiles, setRejectedFiles] = useState([])
  const [isImageValid, setIsImageValid] = useState(true) // Track validity of the image URL
  const hasError = rejectedFiles.length > 0

  const handleDrop = useCallback(
    (_droppedFiles, acceptedFiles, rejectedFiles) => {
      // Replace the files array with the newly uploaded file
      setFiles([...acceptedFiles])
      setRejectedFiles(rejectedFiles)
    },
    [setFiles],
  )

  // Use the new file for display if available, otherwise fallback to the passed image prop
  const displayFiles = files.length > 0
    ? files
    : image
    ? [{ name: 'Uploaded image', size: 0, source: image }]
    : []

  // Check if the image URL is valid
  useEffect(() => {
    if (image) {
      const img = new Image()
      img.onload = () => setIsImageValid(true)
      img.onerror = () => setIsImageValid(false)
      img.src = image
    }
  }, [image])

  const fileUpload = !files.length && !image && <DropZone.FileUpload />

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
  )

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
  )

  return (
    <BlockStack vertical={"true"}>
      {errorMessage}
      <DropZone accept="image/*" type="image" onDrop={handleDrop} disabled={disabled} label="Images">
        {uploadedFiles}
        {fileUpload}
      </DropZone>
    </BlockStack>
  )
}