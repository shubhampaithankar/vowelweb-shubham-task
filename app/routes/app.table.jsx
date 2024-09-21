import { json } from '@remix-run/node'
import { useCallback, useMemo, useState } from 'react'
import { Page, Layout, Card, DataTable, Button, Toast } from '@shopify/polaris'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { authenticate } from "../shopify.server"
import { useModal } from '../hooks/useModal'

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

    const initialProduct = useMemo(() => ({
        id: '',
        title: '',
        description: '',
        price: '',
        vendor: '',
    }), [])

    const { ModalDialog, onOpen } = useModal(initialProduct)

    const addProduct = useCallback(() => {
        onOpen(initialProduct)
        setTitle('add')
    }, [onOpen, initialProduct])

    const editProduct = useCallback((product) => {
        onOpen(product)
        setTitle('edit')
    }, [onOpen])

    const deleteProduct = useCallback((product) => {
        onOpen(product)
        setTitle('delete')
    }, [onOpen])

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
            <ModalDialog submit={submit} title={title}/>
        </Page>
    )
}