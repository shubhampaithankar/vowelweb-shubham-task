import { json } from '@remix-run/node'
import { Page, Layout, Card, DataTable, Button, Modal } from '@shopify/polaris'
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
        
        return json({ success: true })
    }

    return json({ error: "Unsupported action" })
}

export default function TablePage() {
  const { products } = useLoaderData()
  const fetcher = useFetcher()

  console.log('products', products)

  const deleteProduct = async (productId) => {
    fetcher.submit({
        _action: 'delete',
        productId,
      }, { method: 'delete' })
  }

  const rows = products.map((product) => [
    product.title,
    product.description,
    <img src={product.images?.[0]?.src} alt={product.title} width="50" key={product.id} />,
    `$${product.variants[0]?.price || 0}`,
    product.vendor,
    <fetcher.Form method="post" key={product.id}>
      <input type="hidden" name="productId" value={product.id} />
      <Button type="submit" name="_action" value="delete" onClick={() => deleteProduct(product.id)}>Delete</Button>
    </fetcher.Form>
  ])

  return (
    <Page title="Table Page">
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
              headings={['Title', 'Description', 'Image', 'Price', 'Vendor', 'Actions']}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
