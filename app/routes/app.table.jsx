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

export default function TablePage() {
  const { products } = useLoaderData()
  const fetcher = useFetcher()

  console.log('products', products)

  const rows = products.map((product) => [
    product.title,
    product.description,
    <img src={product.images?.[0]?.src} alt={product.title} width="50" key={product.id} />,
    `$${product.variants[0]?.price || 0}`,
    product.vendor,
    <fetcher.Form method="post" key={product.id}>
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