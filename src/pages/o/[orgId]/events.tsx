import { 
    GetServerSideProps,
    NextPageContext,
} from 'next';

export const getServerSideProps : GetServerSideProps = async (context : NextPageContext) => {
    const { orgId } = context.params;
    let allEventsData = [];

    const cRes = await fetch(`http://api.zetk.in/v1/orgs/${orgId}/campaigns`);
    const cData = await cRes.json();
    
    for (const obj of cData.data) {
        const eventsRes = await fetch(`https://api.zetk.in/v1/orgs/${orgId}/campaigns/${obj.id}/actions`);
        const campaignEvents = await eventsRes.json();
        allEventsData = allEventsData.concat(campaignEvents.data);
    }

    const oRes = await fetch(`https://api.zetk.in/v1/orgs/${orgId}`);
    const oData = await oRes.json();

    if (!allEventsData || !oData) {
        return {
            notFound: true,
        };
    }

    return { 
        props: { 
            org: oData.data, 
            events: allEventsData,
        } 
    };
};

type OrgEventsPageProps = {
    org: Record<string, unknown>,
    events: array<Record<string, unknown>>,
}

export default function OrgEventsPage(props : OrgEventsPageProps) : JSX.Element {
    const { org, events } = props;

    return (
        <>
            <h1>Events for { org.title }</h1>
            <ul>
                { events.map((e) => (
                    <li key={ e.id }>{ e.title }</li>
                )) }
            </ul>
        </>
    );
}