const wkhtmltopdf = require('wkhtmltopdf');
const Handlebars = require('handlebars');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { BUCKET_NAME } = process.env;
const s3Client = new S3Client({ region: "us-east-1" });
const MoneyFormat = (value) => {
	const formatter = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
	});

	return formatter.format(value);
};

const streamToBuffer = streamObjectToRead => {
	const chunks = [];
	return new Promise((resolve, reject) => {
		streamObjectToRead
			.on("data", chunk => chunks.push(chunk))
			.on("end", () => resolve(Buffer.concat(chunks)))
			.on("error", err => reject(err));
	});
};

const generatePdfStream = async (plainHTML, data) => {
	try {
		Handlebars.registerHelper('money', function (value) {
			return MoneyFormat(value ? value : 0)
		})

		const template_coverage = Handlebars.compile(plainHTML);
		const html = template_coverage(data);

		const stream = wkhtmltopdf(html, { pageSize: 'letter' });

		return streamToBuffer(stream);
	} catch (error) {
		console.log(error)
		return
	}



}

// Create a function to upload the stream to S3
const uploadStreamToS3 = async (stream, bucket, key) => {
	try {
		const params = {
			Bucket: bucket,
			Key: key,
			Body: stream,
			ContentType: 'application/pdf',
		};

		const s3uploadCommand = new PutObjectCommand(params);

		const result = await s3Client.send(s3uploadCommand);

		return result;
	} catch (error) {
		console.log(error)
		return
	}


};


module.exports.handler = async (event) => {
	try {
		const { html, data, fileName } = JSON.parse(event.body);
		const pdfStream = await generatePdfStream(html, data);
		const result = await uploadStreamToS3(pdfStream, BUCKET_NAME, fileName);

		return {
			statusCode: 200,
			body: JSON.stringify(
				{
					message: 'PDF generated successfully',
					result,
				},
				null,
				2
			),
		};
	} catch (error) {
		return {
			statusCode: 500,
			body: JSON.stringify(
				{
					message: 'Error generating PDF',
					error,
				},
				null,
				2
			),
		};

	}
};
