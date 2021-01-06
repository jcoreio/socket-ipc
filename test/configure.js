/* eslint-disable  @typescript-eslint/no-var-requires */

require('@babel/register')({ extensions: ['.js', '.jsx', '.ts', '.tsx'] })

const chai = require('chai')
chai.use(require('chai-as-promised'))
